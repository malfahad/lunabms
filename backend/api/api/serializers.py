from rest_framework import serializers


class RegisterSerializer(serializers.Serializer):
    business_name = serializers.CharField(max_length=200, trim_whitespace=True)
    business_username = serializers.SlugField(max_length=128)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, max_length=128, trim_whitespace=False, write_only=True)
    confirm_password = serializers.CharField(
        min_length=8,
        max_length=128,
        trim_whitespace=False,
        write_only=True,
    )

    def validate_business_name(self, value):
        clean = value.strip()
        if not clean:
            raise serializers.ValidationError("Business name is required.")
        return clean

    def validate_email(self, value):
        return value.strip().lower()

    def validate_business_username(self, value):
        clean = value.strip().lower()
        if not clean:
            raise serializers.ValidationError("Business username is required.")
        return clean

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": ["Passwords do not match."]})
        return attrs


class LoginSerializer(serializers.Serializer):
    business_username = serializers.SlugField(max_length=128)
    email = serializers.EmailField()
    password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)

    def validate_business_username(self, value):
        clean = value.strip().lower()
        if not clean:
            raise serializers.ValidationError("Business username is required.")
        return clean

    def validate_email(self, value):
        return value.strip().lower()


class ResendVerificationSerializer(serializers.Serializer):
    business_username = serializers.SlugField(max_length=128)
    email = serializers.EmailField()

    def validate_business_username(self, value):
        return value.strip().lower()

    def validate_email(self, value):
        return value.strip().lower()


class VerifyEmailSerializer(serializers.Serializer):
    uid = serializers.CharField(max_length=256, trim_whitespace=True)
    token = serializers.CharField(max_length=256, trim_whitespace=True)


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()


class ResetPasswordSerializer(serializers.Serializer):
    business_username = serializers.SlugField(max_length=128)
    email = serializers.EmailField()
    new_password = serializers.CharField(min_length=8, max_length=128, trim_whitespace=False, write_only=True)
    confirm_new_password = serializers.CharField(
        min_length=8,
        max_length=128,
        trim_whitespace=False,
        write_only=True,
    )

    def validate_business_username(self, value):
        return value.strip().lower()

    def validate_email(self, value):
        return value.strip().lower()

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_new_password"]:
            raise serializers.ValidationError({"confirm_new_password": ["Passwords do not match."]})
        return attrs


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(max_length=1024, trim_whitespace=True)


class SyncPushChangeSerializer(serializers.Serializer):
    id = serializers.CharField(max_length=128, trim_whitespace=True)
    op = serializers.ChoiceField(choices=["upsert", "append", "delete"])
    entity = serializers.CharField(max_length=64, trim_whitespace=True)
    entity_id = serializers.CharField(max_length=128, trim_whitespace=True)
    payload_json = serializers.JSONField(required=False, allow_null=True)
    flags_json = serializers.JSONField(required=False, allow_null=True)
    created_at = serializers.IntegerField(required=False, min_value=0)

    def _validate_required_text(self, value, field_name):
        clean = value.strip()
        if not clean:
            raise serializers.ValidationError(f"{field_name} is required.")
        return clean

    def validate_id(self, value):
        return self._validate_required_text(value, "id")

    def validate_entity(self, value):
        return self._validate_required_text(value, "entity")

    def validate_entity_id(self, value):
        return self._validate_required_text(value, "entity_id")

    def validate_payload_json(self, value):
        if value is not None and not isinstance(value, dict):
            raise serializers.ValidationError("payload_json must be an object when provided.")
        return value

    def validate_flags_json(self, value):
        if value is not None and not isinstance(value, dict):
            raise serializers.ValidationError("flags_json must be an object when provided.")
        return value


class SyncPushSerializer(serializers.Serializer):
    business_name = serializers.CharField(max_length=200, trim_whitespace=True, required=False, allow_blank=True)
    changes = SyncPushChangeSerializer(many=True, min_length=1)


class SyncPullQuerySerializer(serializers.Serializer):
    business_name = serializers.CharField(max_length=200, trim_whitespace=True, required=False, allow_blank=True)
    cursor = serializers.IntegerField(required=False, min_value=0, default=0)
    limit = serializers.IntegerField(required=False, min_value=1, max_value=1000, default=500)
