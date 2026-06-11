import os
import sys
import json
from rank_bm25 import BM25Okapi

# 💡 1. 字典翻譯對應：將中文高頻關鍵字自動對帳到英文，防止語言隔閡引發搜尋失效
TRANS_DICT = {
    "電子商務": "e-commerce shopping store shopify stripe store cart commerce payment",
    "電商": "e-commerce shopping store shopify stripe store cart commerce payment",
    "購物": "e-commerce shopping store shopify stripe store cart commerce payment",
    "金融": "fintech payment stripe bank revolut wise finance money invoice",
    "銀行": "fintech payment stripe bank revolut wise finance money invoice",
    "支付": "fintech payment stripe bank revolut wise finance money invoice",
    "設計": "design figma framer creative art aesthetic visual canvas webflow",
    "美學": "design figma framer creative art aesthetic visual canvas webflow",
    "教育": "education school learn child kid montessori teaching course",
    "學校": "education school learn child kid montessori teaching course",
    "幼兒": "education school learn child kid montessori teaching course",
    "暗黑": "dark black sleep geek shadow linear superhuman",
    "極客": "dark black sleep geek shadow linear superhuman",
    "科技": "tech developer software sentry vercel supabase clickhouse data coding",
    "軟體": "tech developer software sentry vercel supabase clickhouse data coding",
}

def clean_token(text):
    return [w.lower() for x in text.split() for w in x.split("-") if w]

def main():
    if len(sys.argv) < 2:
        print(json.dumps(["stripe", "apple", "vercel"]))
        return

    query = sys.argv[1].strip()
    
    # 💡 智慧語意擴充：若輸入中文，自動翻譯擴充為英文關鍵字
    expanded_query = query
    for cn, en in TRANS_DICT.items():
        if cn in query:
            expanded_query += " " + en

    # 2. 物理掃描 70+ 大廠的 DESIGN.md 文件
    base_dir = "/home/user/.cga/awesome-design-md/design-md"
    if not os.path.exists(base_dir):
        print(json.dumps(["stripe", "apple", "vercel"])) # Fallback
        return

    corpus = []
    brand_names = []
    
    for brand in os.listdir(base_dir):
        brand_path = os.path.join(base_dir, brand)
        if os.path.isdir(brand_path):
            md_path = os.path.join(brand_path, "DESIGN.md")
            if os.path.exists(md_path):
                try:
                    with open(md_path, "r", encoding="utf-8") as f:
                        content = f.read()
                        corpus.append(content.lower())
                        brand_names.append(brand)
                except Exception:
                    pass

    if not corpus:
        print(json.dumps(["stripe", "apple", "vercel"]))
        return

    # 3. 建立 BM25 搜尋索引
    tokenized_corpus = [clean_token(doc) for doc in corpus]
    bm25 = BM25Okapi(tokenized_corpus)
    
    # 4. 執行實時語意搜尋
    tokenized_query = clean_token(expanded_query)
    scores = bm25.get_scores(tokenized_query)
    
    # 5. 排序並抓出 Top 3
    top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:3]
    results = [brand_names[i] for i in top_indices if scores[i] > 0]
    
    # ⚠️ 防呆 Fallback：如果沒有任何匹配，給予最安全的 3 個經典預設
    if not results:
        results = ["stripe", "apple", "vercel"]
        
    print(json.dumps(results))

if __name__ == "__main__":
    main()
