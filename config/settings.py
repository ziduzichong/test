import os
from pathlib import Path
from dotenv import load_dotenv
import dj_database_url

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-change-in-production')
DEBUG = os.getenv('DEBUG', 'True').lower() in ('true', '1', 'yes')
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '127.0.0.1,localhost').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django_ckeditor_5',
    'axes',
    'core',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'axes.middleware.AxesMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [BASE_DIR / 'templates'],
    'APP_DIRS': True,
    'OPTIONS': {
        'context_processors': [
            'django.template.context_processors.debug',
            'django.template.context_processors.request',
            'django.contrib.auth.context_processors.auth',
            'django.contrib.messages.context_processors.messages',
        ],
    },
}]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASE_URL = os.getenv('DATABASE_URL', f'sqlite:///{BASE_DIR / "data" / "db.sqlite3"}')
if DATABASE_URL.startswith('sqlite'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'data' / 'db.sqlite3',
            'OPTIONS': {
                'timeout': 20,
            },
            'CONN_MAX_AGE': 60,
        }
    }
else:
    DATABASES = {
        'default': dj_database_url.parse(DATABASE_URL, conn_max_age=60),
    }

# SQLite WAL 模式 — 通过 connection_created 信号设置
from django.db.backends.signals import connection_created

def set_sqlite_pragma(sender, connection, **kwargs):
    if connection.vendor == 'sqlite':
        cursor = connection.cursor()
        cursor.execute('PRAGMA journal_mode=WAL;')
        cursor.execute('PRAGMA synchronous=NORMAL;')
        cursor.execute('PRAGMA busy_timeout=5000;')
        cursor.execute('PRAGMA cache_size=-8000;')

connection_created.connect(set_sqlite_pragma)

AUTH_USER_MODEL = 'core.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 6}},
]

AUTHENTICATION_BACKENDS = [
    'axes.backends.AxesBackend',
    'django.contrib.auth.backends.ModelBackend',
]

LANGUAGE_CODE = 'zh-hans'
TIME_ZONE = 'Asia/Shanghai'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / os.getenv('MEDIA_ROOT', 'media/uploads')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

LOGIN_URL = '/login/'
LOGIN_REDIRECT_URL = '/dashboard/'
LOGOUT_REDIRECT_URL = '/'

SESSION_COOKIE_AGE = int(os.getenv('SESSION_COOKIE_AGE', '7200'))
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG

FILE_UPLOAD_MAX_SIZE = int(os.getenv('FILE_UPLOAD_MAX_SIZE', '2147483648'))

CKEDITOR_UPLOAD_PATH = 'uploads/ckeditor/'
CKEDITOR_CONFIGS = {
    'default': {
        'toolbar': 'full',
        'height': 400,
        'width': '100%',
    },
}

AXES_FAILURE_LIMIT = 5
AXES_COOLOFF_TIME = 0.25
AXES_RESET_ON_SUCCESS = True

DATA_UPLOAD_MAX_MEMORY_SIZE = 104857600
FILE_UPLOAD_MAX_MEMORY_SIZE = 104857600

SECURE_HSTS_SECONDS = 0 if DEBUG else 63072000
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
