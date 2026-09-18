"""单元测试：middleware.py（ErrorHandlerMiddleware）

用 FastAPI TestClient 在真实 ASGI 栈上验证错误翻译中间件的行为，
覆盖场景：OpenAI 错误形状翻译 / detail 翻译 / 200 不动 / 非 JSON 不动 / 无中间件对照组。
"""

import pytest
from fastapi import FastAPI
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.testclient import TestClient

from litellm_cn.middleware import ErrorHandlerMiddleware, install

#: 模拟 LiteLLM 真实 4xx 错误形状（error.message + type/param/code）
DB_ERROR_PAYLOAD: dict = {
    "error": {
        "message": "No connected db.",
        "type": "no_db_connection",
        "param": None,
        "code": "400",
    }
}


def test_error_message_translated_and_fields_preserved():
    """400 + {"error": {"message": ...}} 形状应被翻译，type/param/code 原样保留"""
    app = FastAPI()
    install(app)

    @app.post("/v1/key/generate")
    def generate_key():
        return JSONResponse(status_code=400, content=DB_ERROR_PAYLOAD)

    client = TestClient(app)
    response = client.post("/v1/key/generate")

    assert response.status_code == 400
    payload = response.json()
    assert payload["error"]["message"].startswith("数据库未连接")
    assert payload["error"]["type"] == "no_db_connection"
    assert payload["error"]["param"] is None
    assert payload["error"]["code"] == "400"


def test_detail_translated():
    """400 + {"detail": "Unauthorized"} 应命中 error.unauthorized 译为中文"""
    app = FastAPI()
    app.add_middleware(ErrorHandlerMiddleware)

    @app.get("/admin/user")
    def get_user():
        return JSONResponse(status_code=400, content={"detail": "Unauthorized"})

    client = TestClient(app)
    response = client.get("/admin/user")

    assert response.status_code == 400
    assert response.json() == {"detail": "未授权访问"}


def test_success_response_untouched():
    """200 正常业务 JSON 必须一字不改"""
    app = FastAPI()
    install(app)

    body = {
        "choices": [{"message": {"role": "assistant", "content": "hello"}}],
        "usage": {"total_tokens": 10},
    }

    @app.get("/chat/completions")
    def completions():
        return JSONResponse(status_code=200, content=body)

    client = TestClient(app)
    response = client.get("/chat/completions")

    assert response.status_code == 200
    assert response.json() == body


def test_non_json_error_untouched():
    """400 + 纯文本响应不属于翻译范围，必须原样返回"""
    app = FastAPI()
    install(app)

    @app.get("/plain")
    def plain_error():
        return PlainTextResponse("No connected db.", status_code=400)

    client = TestClient(app)
    response = client.get("/plain")

    assert response.status_code == 400
    assert response.headers["content-type"].startswith("text/plain")
    assert response.text == "No connected db."


def test_without_middleware_message_stays_english():
    """对照组：不挂中间件时同样的 400 错误形状仍是英文原文，证明翻译来自中间件"""
    app = FastAPI()

    @app.post("/v1/key/generate")
    def generate_key():
        return JSONResponse(status_code=400, content=DB_ERROR_PAYLOAD)

    client = TestClient(app)
    response = client.post("/v1/key/generate")

    assert response.status_code == 400
    payload = response.json()
    assert payload["error"]["message"] == "No connected db."
    assert payload["error"]["type"] == "no_db_connection"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
