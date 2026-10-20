from fastapi import FastAPI, HTTPException
from database import get_connection

app = FastAPI(
    title="VendorVerse API",
    description="Backend API for the VendorVerse e-commerce system",
    version="1.0.0"
)


@app.get("/")
def home():
    return {
        "message": "Welcome to VendorVerse!",
        "status": "Backend is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.get("/api/products")
def get_products():
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute("""
            SELECT
                PRODUCT_ID,
                CATEGORY_ID,
                SKU,
                PRODUCT_NAME,
                DESCRIPTION,
                PRICE,
                REORDER_LEVEL,
                STATUS
            FROM PRODUCT
            ORDER BY PRODUCT_ID
        """)

        rows = cursor.fetchall()

        products = []

        for row in rows:
            products.append({
                "product_id": row[0],
                "category_id": row[1],
                "sku": row[2],
                "product_name": row[3],
                "description": row[4],
                "price": float(row[5]),
                "reorder_level": row[6],
                "status": row[7]
            })

        return {
            "count": len(products),
            "products": products
        }

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve products from the database."
        )

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()