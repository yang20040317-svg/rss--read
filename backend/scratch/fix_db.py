import sqlite3
import os

db_path = "data/rss.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE articles ADD COLUMN create_time INTEGER")
        print("Added create_time")
    except:
        print("create_time already exists or error")
        
    try:
        cursor.execute("ALTER TABLE articles ADD COLUMN update_time INTEGER")
        print("Added update_time")
    except:
        print("update_time already exists or error")
    conn.commit()
    conn.close()
else:
    print("DB not found")
