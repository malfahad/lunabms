from datetime import timedelta

from django.db import migrations, models
from django.utils import timezone
from django.utils.text import slugify


def _dedupe_username(base, used):
    candidate = base
    idx = 2
    while candidate in used:
        candidate = f"{base}-{idx}"
        idx += 1
    used.add(candidate)
    return candidate


def backfill_business_username(apps, schema_editor):
    Tenant = apps.get_model("api", "Tenant")
    used = set(
        Tenant.objects.exclude(business_username__isnull=True)
        .exclude(business_username="")
        .values_list("business_username", flat=True)
    )
    for tenant in Tenant.objects.all().order_by("created_at", "id"):
        existing = (tenant.business_username or "").strip().lower()
        if existing and existing not in used:
            used.add(existing)
            continue
        base = slugify((tenant.tenant_id or tenant.business_name or "").strip()) or "tenant"
        tenant.business_username = _dedupe_username(base, used)
        if not tenant.license_expires_at:
            tenant.license_expires_at = timezone.now() + timedelta(days=30)
        tenant.save(update_fields=["business_username", "license_expires_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="tenant",
            name="business_username",
            field=models.SlugField(blank=True, max_length=128, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="tenant",
            name="license_expires_at",
            field=models.DateTimeField(default=timezone.now),
        ),
        migrations.AddField(
            model_name="user",
            name="email_verified",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(backfill_business_username, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="tenant",
            name="business_username",
            field=models.SlugField(max_length=128, unique=True),
        ),
    ]
