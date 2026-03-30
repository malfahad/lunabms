import uuid

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    email_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = UserManager()

    def __str__(self):
        return self.email


class Tenant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business_name = models.CharField(max_length=200)
    business_username = models.SlugField(max_length=128, unique=True)
    tenant_id = models.SlugField(max_length=128, unique=True)
    logo_path = models.CharField(max_length=512, blank=True, default="")
    license_expires_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.business_name} ({self.tenant_id})"


class TenantMember(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("tenant", "user")


class SyncEntityState(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="entity_states")
    entity = models.CharField(max_length=64)
    entity_id = models.CharField(max_length=128)
    lww_ts = models.BigIntegerField()
    is_deleted = models.BooleanField(default=False)
    payload = models.JSONField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("tenant", "entity", "entity_id")
        indexes = [models.Index(fields=["tenant", "entity", "entity_id"])]


class SyncChange(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="changes")
    entity = models.CharField(max_length=64)
    entity_id = models.CharField(max_length=128)
    op = models.CharField(max_length=16)
    lww_ts = models.BigIntegerField()
    payload = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["tenant", "id"])]


class ProcessedMutation(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="processed_mutations")
    mutation_id = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("tenant", "mutation_id")
