import sqlite3
conn = sqlite3.connect(r'd:\数据存储\wechat-download-api\data\rss.db')
c = conn.cursor()
c.execute("SELECT link, title, length(content_html), length(content_text) FROM articles WHERE length(content_text) < 100")
rows = c.fetchall()
for r in rows:
    print(r)
