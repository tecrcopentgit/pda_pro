from django.urls import path
from . import views
app_name = 'pda_app'

urlpatterns = [
path('home/', views.home, name='home'),
path('', views.login_view, name='login'),
path('register/', views.register_view, name='register'),
path('report/',views.report,name='report'),
path('tests/',views.tests,name='tests'),
path('medicine/',views.medicine,name='prescription' ),
path('remainers/',views.remainders,name='remainder'),
path('profile/', views.Profile, name='profile'),


]
