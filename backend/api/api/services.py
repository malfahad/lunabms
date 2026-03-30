from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Tenant, TenantMember, User


def normalize_tenant_id(business_name: str) -> str:
    value = slugify((business_name or "").strip())
    return value or "tenant"


def unique_tenant_id(seed: str) -> str:
    base = normalize_tenant_id(seed)
    candidate = base
    idx = 2
    while Tenant.objects.filter(tenant_id=candidate).exists():
        candidate = f"{base}-{idx}"
        idx += 1
    return candidate


def issue_tokens(user: User, tenant: Tenant) -> dict:
    refresh = RefreshToken.for_user(user)
    refresh["tenant_id"] = tenant.tenant_id
    refresh["tenant_uuid"] = str(tenant.id)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


@transaction.atomic
def register_user_and_tenant(
    business_name: str,
    business_username: str,
    email: str,
    password: str,
):
    tenant = Tenant.objects.create(
        business_name=business_name.strip(),
        business_username=business_username.strip().lower(),
        tenant_id=business_username.strip().lower(),
        license_expires_at=timezone.now() + timedelta(days=30),
    )
    user = User.objects.create_user(email=email, password=password)
    TenantMember.objects.create(tenant=tenant, user=user)
    return user, tenant
