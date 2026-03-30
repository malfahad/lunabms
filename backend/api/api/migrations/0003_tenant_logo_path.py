from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0002_auth_refactor"),
    ]

    operations = [
        migrations.AddField(
            model_name="tenant",
            name="logo_path",
            field=models.CharField(blank=True, default="", max_length=512),
        ),
    ]
