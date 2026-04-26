**pour demarer le SQLite :**



cd backend

sqlite3 db.sqlite3

sqlite>

exemple des requette :

SELECT \* FROM manufacturing\_company;

SELECT \* FROM manufacturing\_machine;

SELECT \* FROM manufacturing\_product;



**ou avec shell**



**python manage.py shell**

exemple des requettes :

from manufacturing.models import Company, Machine, Product, OperationRoute

&#x20; Company.objects.all()

&#x20; Machine.objects.all()

&#x20; Product.objects.all()

