import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="User",
            fields=[
                ("password", models.CharField(max_length=128, verbose_name="password")),
                ("last_login", models.DateTimeField(blank=True, null=True, verbose_name="last login")),
                ("is_superuser", models.BooleanField(default=False)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("is_active", models.BooleanField(default=True)),
                ("is_staff", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "groups",
                    models.ManyToManyField(
                        blank=True,
                        help_text="The groups this user belongs to.",
                        related_name="user_set",
                        related_query_name="user",
                        to="auth.group",
                    ),
                ),
                (
                    "user_permissions",
                    models.ManyToManyField(
                        blank=True,
                        help_text="Specific permissions for this user.",
                        related_name="user_set",
                        related_query_name="user",
                        to="auth.permission",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Tenant",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("business_name", models.CharField(max_length=200)),
                ("tenant_id", models.SlugField(max_length=128, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name="TenantMember",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("tenant", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="memberships", to="api.tenant")),
                ("user", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="memberships", to="api.user")),
            ],
            options={"unique_together": {("tenant", "user")}},
        ),
        migrations.CreateModel(
            name="SyncEntityState",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("entity", models.CharField(max_length=64)),
                ("entity_id", models.CharField(max_length=128)),
                ("lww_ts", models.BigIntegerField()),
                ("is_deleted", models.BooleanField(default=False)),
                ("payload", models.JSONField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("tenant", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="entity_states", to="api.tenant")),
            ],
            options={"unique_together": {("tenant", "entity", "entity_id")}},
        ),
        migrations.CreateModel(
            name="SyncChange",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("entity", models.CharField(max_length=64)),
                ("entity_id", models.CharField(max_length=128)),
                ("op", models.CharField(max_length=16)),
                ("lww_ts", models.BigIntegerField()),
                ("payload", models.JSONField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("tenant", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="changes", to="api.tenant")),
            ],
        ),
        migrations.CreateModel(
            name="ProcessedMutation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("mutation_id", models.CharField(max_length=128)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="processed_mutations",
                        to="api.tenant",
                    ),
                ),
            ],
            options={"unique_together": {("tenant", "mutation_id")}},
        ),
        migrations.AddIndex(
            model_name="syncentitystate",
            index=models.Index(fields=["tenant", "entity", "entity_id"], name="api_syncent_tenant__d4df74_idx"),
        ),
        migrations.AddIndex(
            model_name="syncchange",
            index=models.Index(fields=["tenant", "id"], name="api_synccha_tenant__aef11b_idx"),
        ),
    ]
