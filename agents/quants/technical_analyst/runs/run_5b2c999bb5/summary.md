# Run run_5b2c999bb5

- **Agent:** `technical_analyst`
- **Task:** technical_analyst run
- **Symbols:** AAPL
- **Model:** —
- **Status:** error
- **Started:** 2026-04-22T04:00:44.217634+00:00
- **Ended:** 2026-04-22T04:00:50.963095+00:00
- **Tokens:** 0
- **Signal:** neutral (confidence 0.0)

## Error

```
ServerError: 503 UNAVAILABLE. {'error': {'code': 503, 'message': 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.', 'status': 'UNAVAILABLE'}}
Traceback (most recent call last):
  File "/Users/sina/project-fire/fyer/backend/adk_agents/base_agent.py", line 176, in run
    output = await self.analyze(context, ctx) if ctx is not None else await self.analyze(context)
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/sina/project-fire/fyer/backend/adk_agents/technical_analyst.py", line 324, in analyze
    response = await client.aio.models.generate_content(
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/miniconda3/envs/fyer/lib/python3.12/site-packages/google/genai/models.py", line 7042, in generate_content
    response = await self._generate_content(
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/miniconda3/envs/fyer/lib/python3.12/site-packages/google/genai/models.py", line 5848, in _generate_content
    response = await self._api_client.async_request(
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/miniconda3/envs/fyer/lib/python3.12/site-packages/google/genai/_api_client.py", line 1432, in async_request
    result = await self._async_request(
             ^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/miniconda3/envs/fyer/lib/python3.12/site-packages/google/genai/_api_client.py", line 1365, in _async_request
    return await self._async_retry(  # type: ignore[no-any-return]
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/miniconda3/envs/fyer/lib/python3.12/site-packages/tenacity/asyncio/__init__.py", line 111, in __call__
    do = await self.iter(retry_state=retry_state)
         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/miniconda3/envs/fyer/lib/python3.12/site-packages/tenacity/asyncio/__init__.py", line 153, in iter
    result = await action(retry_state)
             ^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/miniconda3/envs/fyer/lib/python3.12/site-packages/tenacity/_utils.py", line 99, in inner
    return call(*args, **kwargs)
           ^^^^^^^^^^^^^^^^^^^^^
  File "/opt/miniconda3/envs/fyer/lib/python3.12/site-packages/tenacity/__init__.py", line 420, in exc_check
    raise retry_exc.reraise()
          ^^^^^^^^^^^^^^^^^^^
  File "/opt/miniconda3/envs/fyer/lib/python3.12/site-packages/tenacity/__init__.py", line 187, in reraise
    raise self.last_attempt.result()
          ^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/miniconda3/envs/fyer/lib/python3.12/concurrent/futures/_base.py", line 449, in result
    return self.__get_result()
           ^^^^^^^^^^^^^^^^^^^
  File "/opt/miniconda3/envs/fyer/lib/python3.12/concurrent/futures/_base.py", line 401, in __get_result
    raise self._exception
  File "/opt/miniconda3/envs/fyer/lib/python3.12/site-packages/tenacity/asyncio/__init__.py", line 114, in __call__
    result = await fn(*args, **kwargs)
             ^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/miniconda3/envs/fyer/lib/python3.12/site-packages/google/genai/_api_client.py", line 1310, in _async_request_once
    await errors.APIError.raise_for_async_response(response)
  File "/opt/miniconda3/envs/fyer/lib/python3.12/site-packages/google/genai/errors.py", line 203, in raise_for_async_response
    await cls.raise_error_async(status_code, response_json, response)
  File "/opt/miniconda3/envs/fyer/lib/python3.12/site-packages/google/genai/errors.py", line 227, in raise_error_async
    raise ServerError(status_code, response_json, response)
google.genai.errors.ServerError: 503 UNAVAILABLE. {'error': {'code': 503, 'message': 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.', 'status': 'UNAVAILABLE'}}

```
