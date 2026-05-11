import sqlite3
conn = sqlite3.connect('data/rss.db')
res = conn.execute("SELECT sql FROM sqlite_master WHERE name='articles'").fetchone()
if res:
    print(res[0])
else:
    print("No table")
conn.close()
