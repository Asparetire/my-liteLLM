"""FastAPI 错误响应拦截中间件

将后端返回的错误消息翻译为中文（默认 zh-CN）。设计约束见 dev-plans/03：
- 仅处理 Content-Type: application/json 的 4xx/5xx 响应
- 只改写 error/message/detail 字段的字符串值，不动字段名与错误类型标识
- 任何异常都返回原始响应，绝不因翻译导致接口异常
"""

import json
import os
from typing import TYPE_CHECKING, Final

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from litellm_cn.translator import get_translated_error

if TYPE_CHECKING:
    from fastapi import FastAPI

#: 设为 1/true/yes 时关闭翻译，行为与原生完全一致
ENV_DISABLE: Final = "LITELLM_CN_ERROR_TRANSLATION_DISABLED"


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """拦截错误响应并翻译 message/detail 字段的中间件"""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        # 只处理 JSON 错误响应
        if response.status_code < 400:
            return response
        if "application/json" not in response.headers.get("content-type", ""):
            return response

        # BaseHTTPMiddleware 返回流式响应，完整字节只能从 body_iterator 消费获得
        # （starlette 1.x 的 Response 没有 body() 方法，流式响应的 self.body 也未赋值）
        try:
            body = b"".join([chunk async for chunk in response.body_iterator])
        except Exception:
            return response

        try:
            payload = json.loads(body.decode("utf-8"))
            if not isinstance(payload, dict):
                return _rebuild(response, body)

            translated = get_translated_error(payload)
            if translated == payload:
                return _rebuild(response, body)

            # content-length 由 JSONResponse 重新计算，需剔除旧值
            headers = {
                key: value
                for key, value in response.headers.items()
                if key.lower() != "content-length"
            }
            return JSONResponse(
                status_code=response.status_code,
                content=translated,
                headers=headers,
            )
        except Exception:
            # 翻译过程出错时返回原始响应（迭代器已消费，需用原始字节重建）
            return _rebuild(response, body)


def _rebuild(response: Response, body: bytes) -> Response:
    """用已消费的原始字节重建响应，保证未翻译路径返回体一字不改"""
    return Response(
        content=body,
        status_code=response.status_code,
        headers=dict(response.headers),
    )


def install(app: "FastAPI") -> None:
    """注册错误翻译中间件；设置 LITELLM_CN_ERROR_TRANSLATION_DISABLED=1 可关闭"""
    if os.getenv(ENV_DISABLE, "").strip().lower() in ("1", "true", "yes"):
        return
    app.add_middleware(ErrorHandlerMiddleware)
