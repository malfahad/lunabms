from django.contrib import admin

from .models import ProcessedMutation, SyncChange, SyncEntityState, Tenant, TenantMember, User


admin.site.register(User)
admin.site.register(Tenant)
admin.site.register(TenantMember)
admin.site.register(SyncEntityState)
admin.site.register(SyncChange)
admin.site.register(ProcessedMutation)
