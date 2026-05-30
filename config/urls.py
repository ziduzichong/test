from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('ckeditor/', include('django_ckeditor_5.urls')),
    path('', include('core.urls')),
]
