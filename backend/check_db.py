import sqlite3
conn = sqlite3.connect(r'd:\数据存储\wechat-download-api\data\rss.db')
c = conn.cursor()
c.execute("SELECT link, length(content_html), length(content_text), title FROM articles ORDER BY create_time DESC LIMIT 10")
rows = c.fetchall()
for row in rows:
    print(f"[{row[1]}] / [{row[2]}] : {row[3]}")
