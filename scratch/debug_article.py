import asyncio
import httpx
from utils.http_client import fetch_page
from utils.content_processor import process_article_content

async def debug_article():
    url = "https://mp.weixin.qq.com/s/6XT6GXhS-67rYNL7QbEsHg"
    html = await fetch_page(url)
    with open("scratch/debug_article.html", "w", encoding="utf-8") as f:
        f.write(html)
    
    result = process_article_content(html)
    print(f"Content length: {len(result['content'])}")
    print(f"Title: {result.get('title', 'N/A')}")
    
    with open("scratch/debug_result.html", "w", encoding="utf-8") as f:
        f.write(result['content'])

if __name__ == "__main__":
    asyncio.run(debug_article())
