import mimetypes
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.storage import default_storage
from django.db import IntegrityError, transaction
from django.http import FileResponse, Http404
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.text import slugify
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from rest_framework_simplejwt.views import TokenRefreshView

from .models import ProcessedMutation, SyncChange, SyncEntityState, Tenant, TenantMember
from .serializers import (
    ForgotPasswordSerializer,
    LoginSerializer,
    LogoutSerializer,
    RegisterSerializer,
    ResendVerificationSerializer,
    ResetPasswordSerializer,
    SyncPullQuerySerializer,
    SyncPushSerializer,
    VerifyEmailSerializer,
)
from .services import issue_tokens, register_user_and_tenant

User = get_user_model()

APPEND_ONLY_ENTITIES = {"posts", "payments", "retainer_applications"}


def tenant_logo_url(request, tenant):
    if not tenant or not tenant.logo_path:
        return None
    return request.build_absolute_uri(f"/api/branding/logo/{tenant.tenant_id}/")


def _send_verification_email(user, tenant):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    base_url = getattr(settings, "AUTH_VERIFY_EMAIL_URL", "").strip()
    if base_url:
        separator = "&" if "?" in base_url else "?"
        verify_url = f"{base_url}{separator}uid={uid}&token={token}"
    else:
        verify_url = f"uid={uid} token={token}"
    send_mail(
        subject="Verify your ServOps account email",
        message=(
            f"Hi,\n\n"
            f"Please verify your email for {tenant.business_name} ({tenant.business_username}).\n"
            f"Use this link/token: {verify_url}\n\n"
            f"If you did not create this account, ignore this email."
        ),
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@servops.com"),
        recipient_list=[user.email],
        fail_silently=False,
    )


def tenant_from_business_name(name: str):
    tenant_id = slugify((name or "").strip())
    if tenant_id:
        tenant = Tenant.objects.filter(tenant_id=tenant_id).first()
        if tenant:
            return tenant
        tenant = Tenant.objects.filter(business_username=tenant_id).first()
        if tenant:
            return tenant
    tenant = Tenant.objects.filter(business_name__iexact=(name or "").strip()).first()
    if tenant:
        return tenant
    raise Http404("Tenant not found")


def tenant_from_business_username(value: str):
    business_username = slugify((value or "").strip())
    if not business_username:
        raise Http404("Tenant not found")
    return Tenant.objects.get(business_username=business_username)


def resolve_tenant_for_user(user, business_name: str):
    tenant = tenant_from_business_name(business_name)
    if not TenantMember.objects.filter(tenant=tenant, user=user).exists():
        raise Http404("Membership not found")
    return tenant


def resolve_tenant_from_token(request, user):
    token = getattr(request, "auth", None)
    tenant_uuid = token.get("tenant_uuid") if token is not None else None
    tenant_slug = token.get("tenant_id") if token is not None else None
    tenant = None
    if tenant_uuid:
        tenant = Tenant.objects.filter(id=tenant_uuid).first()
    if tenant is None and tenant_slug:
        tenant = Tenant.objects.filter(tenant_id=tenant_slug).first()
    if tenant is None or not TenantMember.objects.filter(tenant=tenant, user=user).exists():
        raise Http404("Membership not found")
    return tenant


def parse_payload(change):
    payload = change.get("payload_json")
    if payload is None:
        return None
    if isinstance(payload, dict):
        return payload
    return None


def attach_license_expiry_header(response, tenant):
    if tenant.license_expires_at:
        expires_at = tenant.license_expires_at.isoformat()
        response["licenseExpiresAt"] = expires_at
        response["X-License-Expires-At"] = expires_at
    return response


def compute_lww_ts(change, payload):
    if isinstance(payload, dict):
        for key in ("updated_at", "created_at"):
            val = payload.get(key)
            if isinstance(val, (int, float)):
                return int(val)
    created_at = change.get("created_at")
    if isinstance(created_at, (int, float)):
        return int(created_at)
    return 0


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        business_username = data["business_username"]
        email = data["email"]
        if Tenant.objects.filter(business_username=business_username).exists():
            return Response(
                {"business_username": ["Business username is already taken."]},
                status=status.HTTP_409_CONFLICT,
            )
        if (
            TenantMember.objects.filter(tenant__business_username=business_username, user__email=email)
            .select_related("tenant", "user")
            .exists()
        ):
            return Response(
                {"detail": "Business username and email combination already exists."},
                status=status.HTTP_409_CONFLICT,
            )
        if User.objects.filter(email=email).exists():
            return Response(
                {"email": ["A user with this email already exists."]},
                status=status.HTTP_409_CONFLICT,
            )
        try:
            user, tenant = register_user_and_tenant(
                business_name=data["business_name"],
                business_username=business_username,
                email=email,
                password=data["password"],
            )
        except IntegrityError:
            return Response(
                {"email": ["A user with this email already exists."]},
                status=status.HTTP_409_CONFLICT,
            )
        _send_verification_email(user, tenant)
        return Response(
            {
                "tenant_id": tenant.tenant_id,
                "business_name": tenant.business_name,
                "business_username": tenant.business_username,
                "logo_url": tenant_logo_url(request, tenant),
                "email": user.email,
                "email_verified": user.email_verified,
                "license_expires_at": tenant.license_expires_at,
                "detail": "Registration successful. Please verify your email.",
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            tenant = tenant_from_business_username(data["business_username"])
        except Http404:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        email = data["email"]
        user = User.objects.filter(email=email).first()
        if not user or not user.check_password(data["password"]):
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        if not TenantMember.objects.filter(tenant=tenant, user=user).exists():
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        if not user.email_verified:
            return Response(
                {
                    "gate": "email_not_verified",
                    "detail": "Email is not verified.",
                    "cta": "resend_verification_email",
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        if tenant.license_expires_at <= timezone.now():
            return Response(
                {
                    "gate": "license_expired",
                    "detail": "License is expired.",
                    "cta": "Contact support support@servops.com",
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        tokens = issue_tokens(user, tenant)
        return Response(
            {
                "tenant_id": tenant.tenant_id,
                "business_name": tenant.business_name,
                "business_username": tenant.business_username,
                "logo_url": tenant_logo_url(request, tenant),
                "email": user.email,
                "email_verified": user.email_verified,
                "license_expires_at": tenant.license_expires_at,
                **tokens,
            }
        )


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uid = serializer.validated_data["uid"]
        token = serializer.validated_data["token"]
        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({"detail": "Invalid verification link."}, status=status.HTTP_400_BAD_REQUEST)
        if not default_token_generator.check_token(user, token):
            return Response({"detail": "Invalid verification link."}, status=status.HTTP_400_BAD_REQUEST)
        if not user.email_verified:
            user.email_verified = True
            user.save(update_fields=["email_verified"])
        membership = (
            TenantMember.objects.select_related("tenant")
            .filter(user=user)
            .order_by("created_at")
            .first()
        )
        if not membership:
            return Response({"detail": "No tenant membership found."}, status=status.HTTP_400_BAD_REQUEST)
        tenant = membership.tenant
        if tenant.license_expires_at <= timezone.now():
            return Response(
                {
                    "gate": "license_expired",
                    "detail": "License is expired.",
                    "cta": "Contact support support@servops.com",
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        tokens = issue_tokens(user, tenant)
        return Response(
            {
                "detail": "Email verified successfully.",
                "tenant_id": tenant.tenant_id,
                "business_name": tenant.business_name,
                "business_username": tenant.business_username,
                "logo_url": tenant_logo_url(request, tenant),
                "email": user.email,
                "email_verified": user.email_verified,
                "license_expires_at": tenant.license_expires_at,
                **tokens,
            },
            status=status.HTTP_200_OK,
        )


class ResendVerificationView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        tenant = Tenant.objects.filter(business_username=data["business_username"]).first()
        user = User.objects.filter(email=data["email"]).first()
        if not tenant or not user or not TenantMember.objects.filter(tenant=tenant, user=user).exists():
            return Response({"detail": "Account not found."}, status=status.HTTP_404_NOT_FOUND)
        _send_verification_email(user, tenant)
        return Response({"detail": "Verification email sent."}, status=status.HTTP_200_OK)


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        user = User.objects.filter(email=email).first()
        if not user:
            return Response(
                {"email": ["No account found for this email."]},
                status=status.HTTP_404_NOT_FOUND,
            )
        tenants = Tenant.objects.filter(memberships__user=user).distinct()
        if not tenants.exists():
            return Response(
                {"email": ["No tenant found for this email."]},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(
            {
                "email": email,
                "tenants": [
                    {
                        "business_name": tenant.business_name,
                        "business_username": tenant.business_username,
                    }
                    for tenant in tenants
                ],
            }
        )


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        tenant = Tenant.objects.filter(business_username=data["business_username"]).first()
        user = User.objects.filter(email=data["email"]).first()
        if not tenant or not user or not TenantMember.objects.filter(tenant=tenant, user=user).exists():
            return Response({"detail": "Invalid tenant/email combination."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_password(data["new_password"], user=user)
        except DjangoValidationError as exc:
            return Response({"new_password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(data["new_password"])
        user.save(update_fields=["password"])
        return Response({"detail": "Password reset successful."}, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        refresh = serializer.validated_data["refresh"]
        try:
            token = RefreshToken(refresh)
            token.blacklist()
        except TokenError:
            # already expired/invalid/blacklisted; local session can still be cleared
            pass
        return Response({"detail": "Logged out"}, status=status.HTTP_200_OK)


class TenantLogoUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        tenant = resolve_tenant_from_token(request, request.user)
        logo = request.FILES.get("logo")
        if not logo:
            return Response({"detail": "logo file is required."}, status=status.HTTP_400_BAD_REQUEST)
        if logo.size > 5 * 1024 * 1024:
            return Response({"detail": "Logo file must be 5MB or smaller."}, status=status.HTTP_400_BAD_REQUEST)
        content_type = (logo.content_type or "").lower()
        if not content_type.startswith("image/"):
            return Response({"detail": "Only image uploads are allowed."}, status=status.HTTP_400_BAD_REQUEST)

        ext = Path(logo.name or "").suffix.lower()
        if ext not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
            guessed = mimetypes.guess_extension(content_type) or ".jpg"
            ext = ".jpg" if guessed == ".jpe" else guessed
        rel = f"logos/{tenant.tenant_id}/{uuid4().hex}{ext}"

        if tenant.logo_path and default_storage.exists(tenant.logo_path):
            try:
                default_storage.delete(tenant.logo_path)
            except Exception:
                pass

        saved_path = default_storage.save(rel, logo)
        tenant.logo_path = saved_path
        tenant.save(update_fields=["logo_path"])
        logo_url = request.build_absolute_uri(f"/api/branding/logo/{tenant.tenant_id}/")
        return Response({"tenant_id": tenant.tenant_id, "logo_url": logo_url}, status=status.HTTP_200_OK)


class TenantLogoView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, tenant_id):
        tenant = Tenant.objects.filter(tenant_id=tenant_id).first()
        if not tenant or not tenant.logo_path:
            raise Http404("Logo not found")
        if not default_storage.exists(tenant.logo_path):
            raise Http404("Logo file not found")
        fh = default_storage.open(tenant.logo_path, "rb")
        content_type, _ = mimetypes.guess_type(tenant.logo_path)
        resp = FileResponse(fh, content_type=content_type or "application/octet-stream")
        resp["Cache-Control"] = "public, max-age=3600"
        return resp


class SyncPushView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = SyncPushSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        tenant = resolve_tenant_from_token(request, request.user)
        incoming = payload["changes"]

        results = []
        for change in incoming:
            queue_id = change["id"]
            try:
                ProcessedMutation.objects.create(tenant=tenant, mutation_id=queue_id)
            except IntegrityError:
                results.append({"queue_id": queue_id, "status": "duplicate"})
                continue

            op = change["op"]
            entity = change["entity"]
            entity_id = change["entity_id"]
            payload = parse_payload(change)
            lww_ts = compute_lww_ts(change, payload)
            append_only = entity in APPEND_ONLY_ENTITIES or bool((change.get("flags_json") or {}).get("appendOnly"))

            if op == "append" or append_only:
                SyncEntityState.objects.get_or_create(
                    tenant=tenant,
                    entity=entity,
                    entity_id=entity_id,
                    defaults={"lww_ts": lww_ts, "is_deleted": False, "payload": payload},
                )
                SyncChange.objects.create(
                    tenant=tenant,
                    entity=entity,
                    entity_id=entity_id,
                    op="append",
                    lww_ts=lww_ts,
                    payload=payload,
                )
                results.append({"queue_id": queue_id, "status": "applied"})
                continue

            state = SyncEntityState.objects.filter(tenant=tenant, entity=entity, entity_id=entity_id).first()
            state_lww = state.lww_ts if state else -1
            if lww_ts < state_lww:
                results.append({"queue_id": queue_id, "status": "stale"})
                continue

            if op == "delete":
                SyncEntityState.objects.update_or_create(
                    tenant=tenant,
                    entity=entity,
                    entity_id=entity_id,
                    defaults={"lww_ts": lww_ts, "is_deleted": True, "payload": None},
                )
                SyncChange.objects.create(
                    tenant=tenant,
                    entity=entity,
                    entity_id=entity_id,
                    op="delete",
                    lww_ts=lww_ts,
                    payload=None,
                )
            else:
                SyncEntityState.objects.update_or_create(
                    tenant=tenant,
                    entity=entity,
                    entity_id=entity_id,
                    defaults={"lww_ts": lww_ts, "is_deleted": False, "payload": payload},
                )
                SyncChange.objects.create(
                    tenant=tenant,
                    entity=entity,
                    entity_id=entity_id,
                    op="upsert",
                    lww_ts=lww_ts,
                    payload=payload,
                )
            results.append({"queue_id": queue_id, "status": "applied"})

        response = Response({"results": results})
        return attach_license_expiry_header(response, tenant)


class SyncPullView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = SyncPullQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        tenant = resolve_tenant_from_token(request, request.user)
        cursor = data["cursor"]
        limit = data["limit"]

        rows = (
            SyncChange.objects.filter(tenant=tenant, id__gt=cursor).order_by("id")[:limit]
        )
        changes = [
            {
                "seq": row.id,
                "op": row.op,
                "entity": row.entity,
                "entity_id": row.entity_id,
                "lww_ts": row.lww_ts,
                "payload": row.payload,
            }
            for row in rows
        ]
        next_cursor = cursor
        if changes:
            next_cursor = changes[-1]["seq"]
        response = Response({"cursor": cursor, "next_cursor": next_cursor, "changes": changes})
        return attach_license_expiry_header(response, tenant)


class SyncTokenRefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]
