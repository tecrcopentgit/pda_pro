from django.shortcuts import render
from django.contrib.auth.decorators import login_required


def register_view(request):
    return render(request, 'pda_app/register.html')
    
def login_view(request):
    return render(request, 'pda_app/login.html')
    

def home(request):
    return render(request, 'pda_app/home.html')

def Profile(request):
    return render(request, 'pda_app/profile.html')

def report(request):
    return render(request, 'pda_app/reports.html')

def tests(request):
    return render(request,'pda_app/test.html')


def medicine(request):
    return render(request, 'pda_app/medicine.html')

def remainders(request):
    return render(request, 'pda_app/remainders.html')

