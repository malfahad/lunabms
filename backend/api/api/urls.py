from django.urls import path

from .views import (
    ForgotPasswordView,
    LoginView,
    MediaFileView,
    MediaUploadView,
    LogoutView,
    RegisterView,
    ResendVerificationView,
    ResetPasswordView,
    SyncPullView,
    SyncPushView,
    TenantLogoUploadView,
    TenantLogoView,
    SyncTokenRefreshView,
    VerifyEmailView,
)


urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/verify-email/", VerifyEmailView.as_view(), name="auth-verify-email"),
    path("auth/verify-email/resend/", ResendVerificationView.as_view(), name="auth-verify-email-resend"),
    path("auth/password/forgot/", ForgotPasswordView.as_view(), name="auth-password-forgot"),
    path("auth/password/reset/", ResetPasswordView.as_view(), name="auth-password-reset"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/token/refresh/", SyncTokenRefreshView.as_view(), name="auth-refresh"),
    path("branding/logo/upload/", TenantLogoUploadView.as_view(), name="branding-logo-upload"),
    path("branding/logo/<slug:tenant_id>/", TenantLogoView.as_view(), name="branding-logo"),
    path("media/upload/", MediaUploadView.as_view(), name="media-upload"),
    path("media/file/<slug:tenant_id>/<str:file_name>/", MediaFileView.as_view(), name="media-file"),
    path("sync/push/", SyncPushView.as_view(), name="sync-push"),
    path("sync/pull/", SyncPullView.as_view(), name="sync-pull"),
]
