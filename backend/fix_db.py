import sqlite3

conn = sqlite3.connect(r'd:\数据存储\wechat-download-api\data\rss.db')
c = conn.cursor()

# Find articles where title is over 60 chars
c.execute("SELECT aid, title FROM articles WHERE length(title) > 60")
rows = c.fetchall()

for row in rows:
    aid, title = row
    new_title = title[:50] + "..."
    c.execute("UPDATE articles SET title = ? WHERE aid = ?", (new_title, aid))
    print(f"Updated: {aid}")

# Also delete the cached html/text so the backend forces a re-fetch of content when clicked?
# Wait, if we set content_text to '' and content_html to '', the frontend might not display it correctly?
# In App.jsx, if content_text is empty, it uses summary. If summary is empty, it fails.
# Actually, if we just empty content_html, will it re-fetch?
# `routes/article.py` only updates the DB when the article is parsed, but the frontend calls `/api/article/parse` with the URL!
# In App.jsx, `fetchArticleContent` calls `/api/article/parse` and returns the html. It does NOT use `article.content_text` for the reading view, it only uses `content_text` for the AI analysis!
# So if we empty `content_text` in DB, wait, the frontend has ALREADY cached it in IndexedDB or State!
# If the user restarts the app, the state is reloaded from `/api/rss/articles`.

c.execute("UPDATE articles SET content_text = '', content_html = '' WHERE length(title) > 60")
conn.commit()
conn.close()
