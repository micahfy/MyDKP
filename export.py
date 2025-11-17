import requests

BASE_URL = "url地址"
USERNAME = "admin"
PASSWORD = ""

with requests.Session() as session:
    # 1. 登录
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "username": USERNAME,
        "password": PASSWORD,
    })
    resp.raise_for_status()

    # 2. 获取 WebDKP 数据
    resp = session.get(f"{BASE_URL}/api/export/webdkp")
    resp.raise_for_status()
    lua_content = resp.text

    # 3. 写入文件
    with open("export.log", "w", encoding="utf-8") as f:
        f.write(lua_content)

print("已保存到 export.log")