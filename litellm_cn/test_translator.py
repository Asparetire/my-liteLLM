"""单元测试：translator.py

覆盖场景：精确命中 / 错误码 key / 占位符模板 / 未命中回退 / 空串 / 错误形状改写。
"""

import pytest

from litellm_cn.translator import get_translated_error, translate_message


def test_exact_message_hit():
    """key 为英文原文全量字符串时精确命中"""
    msg = "Authentication Error, Invalid proxy server token passed."
    assert translate_message(msg) == "认证失败：代理服务器令牌无效。"


def test_error_code_key_normalizes_spaces():
    """"Internal server error"（空格）应命中 error.internal_server_error"""
    assert translate_message("Internal server error") == "内部服务器错误"
    assert translate_message("Unauthorized") == "未授权访问"
    assert translate_message("Forbidden") == "禁止访问"


def test_placeholder_template_extracts_params():
    """占位符模板应从原文提取参数并填入译文"""
    result = translate_message("Rate limit exceeded. Please retry after: 60s")
    assert "60" in result
    assert "秒重试" in result


def test_placeholder_model_template():
    result = translate_message("You do not have access to model gpt-4o.")
    assert "gpt-4o" in result
    assert "无权访问" in result


def test_miss_returns_original():
    """未收录的错误必须原样返回，降级安全"""
    msg = "totally unknown upstream failure xyz"
    assert translate_message(msg) == msg


def test_empty_string():
    assert translate_message("") == ""


def test_detail_shape_translated():
    """{"detail": "..."} 形状"""
    result = get_translated_error({"detail": "Unauthorized"})
    assert result["detail"] == "未授权访问"


def test_openai_error_shape_translated():
    """{"error": {"message": ...}} 形状；type/code 等标识不得被改写"""
    payload = {
        "error": {
            "message": "Invalid API Key",
            "type": "invalid_request_error",
            "code": "invalid_api_key",
        }
    }
    result = get_translated_error(payload)
    assert result["error"]["message"] == "API key 无效"
    assert result["error"]["type"] == "invalid_request_error"
    assert result["error"]["code"] == "invalid_api_key"


def test_nested_error_inside_message_translated():
    """{"error": {"message": {"error": "..."}}} 嵌套形状"""
    payload = {"error": {"message": {"error": "Invalid API Key"}}}
    result = get_translated_error(payload)
    assert result["error"]["message"]["error"] == "API key 无效"


def test_business_payload_untouched():
    """正常业务响应体（无 error/message/detail 字符串值）不得被改写"""
    payload = {
        "choices": [{"message": {"role": "assistant", "content": "hello"}}],
        "usage": {"total_tokens": 10},
    }
    assert get_translated_error(payload) == payload


def test_field_names_preserved():
    """只替换字符串值，错误结构与字段名完全不变"""
    payload = {"error": {"message": "Unauthorized", "param": None}}
    result = get_translated_error(payload)
    assert list(result.keys()) == ["error"]
    assert list(result["error"].keys()) == ["message", "param"]
    assert result["error"]["param"] is None


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
