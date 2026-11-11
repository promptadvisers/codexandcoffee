import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("relay_backend", Path(__file__).with_name("backend.py"))
backend = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backend)


class BackendTests(unittest.TestCase):
    def test_desktop_cli_uses_vendor_command(self):
        import tempfile, os
        with tempfile.TemporaryDirectory() as directory:
            executable = Path(directory) / "gws"
            executable.write_text("#!/bin/sh\n[ \"$1\" = \"gmail\" ] || exit 3\nprintf '%s\\n' '{\"emailAddress\":\"fixture@example.test\"}'\n")
            executable.chmod(0o700)
            with patch.dict(os.environ, {"RELAY_GWS_BIN": str(executable)}):
                result = backend.cli(["gws", "primary", "gmail", "users", "getProfile"])
                self.assertEqual(result["emailAddress"], "fixture@example.test")

    def test_selected_profile_removes_inherited_bearer(self):
        with patch.object(backend, "private_env", side_effect=lambda key: "/tmp/vendor-gws" if key == "RELAY_GWS_BIN" else None):
            args, env = backend.google_command(["gws", "work", "gmail", "users", "getProfile"], {"PATH":"/usr/bin", "GOOGLE_WORKSPACE_CLI_TOKEN":"fixture", "GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE":"/tmp/fixture"})
            self.assertEqual(args, ["/tmp/vendor-gws", "gmail", "users", "getProfile"])
            self.assertTrue(env["GOOGLE_WORKSPACE_CLI_CONFIG_DIR"].endswith("/google-workspace/work"))
            self.assertNotIn("GOOGLE_WORKSPACE_CLI_TOKEN", env)
            self.assertNotIn("GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE", env)

    def test_dedicated_private_provider_file(self):
        import tempfile, os
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "providers.env"
            target.write_text("RELAY_TEST_SETTING=fixture-value\n")
            with patch.dict(os.environ, {"RELAY_ENV_FILE": str(target)}):
                self.assertEqual(backend.private_env("RELAY_TEST_SETTING"), "fixture-value")

    def test_action_and_account_allowlist(self):
        with self.assertRaises(backend.BridgeError):
            backend.dispatch({"action": "send", "to": "x@example.com"})
        with self.assertRaises(backend.BridgeError):
            backend.account("primary; rm -rf /tmp/test")
        with self.assertRaises(backend.BridgeError):
            backend.model_name("x/../../bad", backend.TEXT_MODEL)

    def test_draft_validation_and_fluid_wrapper(self):
        with self.assertRaises(backend.BridgeError):
            backend.valid_draft({"to": "two@example.com,other@example.com", "subject": "Hi", "body": "Text"})
        with patch.object(backend, "run_command") as run, patch.object(backend, "cli") as readback:
            run.return_value.returncode = 0
            run.return_value.stdout = '{"id":"abcdef1234567890"}'
            readback.return_value = {"id": "abcdef1234567890", "message": {"labelIds": ["DRAFT"]}}
            result = backend.draft({"account": "primary", "to": "one@example.com", "subject": "Hello", "body": "One long ordinary paragraph."})
            self.assertEqual(result["labels"], ["DRAFT"])
            args = run.call_args.args[0]
            self.assertEqual(args[:3], ["gws-mail", "draft", "create"])
            self.assertIn("--fluid", args)
            self.assertIn("--body-file", args)
            self.assertNotIn("send", args)
            self.assertEqual(readback.call_args.args[0][0:4], ["gws", "primary", "gmail", "users"])

    def test_ask_draft_is_only_preview(self):
        calls = [
            {"candidates": [{"content": {"role": "model", "parts": [{"functionCall": {"name": "prepare_draft", "args": {"to": "one@example.com", "subject": "Hello", "body": "Unsent."}}}]}}]},
            {"candidates": [{"content": {"role": "model", "parts": [{"text": "Here is a draft preview."}]}}]},
        ]
        with patch.object(backend, "gemini", side_effect=calls), patch.object(backend, "run_command") as run:
            result = backend.ask({"action": "ask", "text": "Prepare a draft for me", "account": "primary"})
            self.assertEqual(result["draft"]["body"], "Unsent.")
            run.assert_not_called()

    def test_ask_rejects_arbitrary_gmail_read(self):
        response = {"candidates": [{"content": {"role": "model", "parts": [{"functionCall": {"name": "gmail_read", "args": {"message_id": "abcdef1234567890"}}}]}}]}
        with patch.object(backend, "gemini", return_value=response), patch.object(backend, "gmail_read") as read:
            with self.assertRaises(backend.BridgeError):
                backend.ask({"text": "Read my mail"})
            read.assert_not_called()

    def test_ask_limits_tools_and_rejects_unknown_operation(self):
        response = {"candidates": [{"content": {"role": "model", "parts": [{"functionCall": {"name": "send_email", "args": {}}}]}}]}
        with patch.object(backend, "gemini", return_value=response):
            with self.assertRaises(backend.BridgeError):
                backend.ask({"text": "Send email"})

    def test_web_url_guard(self):
        for url in ("http://example.com", "https://localhost/a", "https://127.0.0.1/a", "file:///etc/passwd", "https://user:pass@example.com", "https://[::1]/", "https://localhost./"):
            with self.assertRaises(backend.BridgeError):
                backend.safe_web_url(url)

    def test_safe_provider_error_and_missing_configuration(self):
        import urllib.error
        error = urllib.error.HTTPError("https://example.com", 401, "private error", {}, None)
        with patch.object(backend.urllib.request, "urlopen", side_effect=error):
            with self.assertRaises(backend.BridgeError) as caught:
                backend.json_http("https://example.com", {}, {})
            self.assertNotIn("private error", str(caught.exception))
            self.assertIn("HTTP 401", str(caught.exception))
        with patch.object(backend, "private_env", return_value=None):
            with self.assertRaisesRegex(backend.BridgeError, "Gemini is not configured"):
                backend.gemini({}, backend.TEXT_MODEL)
            with self.assertRaisesRegex(backend.BridgeError, "Firecrawl is not configured"):
                backend.firecrawl("search", {})

    def test_silence_and_empty_audio_are_errors(self):
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".m4a") as recording:
            with self.assertRaises(backend.BridgeError):
                backend.transcribe({"audio_path": recording.name})
            recording.write(b"fixture" * 30); recording.flush()
            response = {"candidates": [{"content": {"parts": [{"text": "[silence]"}]}}]}
            with patch.object(backend, "gemini", return_value=response):
                with self.assertRaisesRegex(backend.BridgeError, "No intelligible speech"):
                    backend.transcribe({"audio_path": recording.name})

    def test_smart_transcription_validates_route_without_executing_tools(self):
        import tempfile, json
        with tempfile.NamedTemporaryFile(suffix=".m4a") as recording:
            recording.write(b"fixture" * 30); recording.flush()
            for intent in ("dictate", "ask"):
                response = {"candidates": [{"content": {"parts": [{"text": json.dumps({"text": "Hello there", "intent": intent, "tool_request": "email_read" if intent == "ask" else "none"})}]}}]}
                with patch.object(backend, "gemini", return_value=response) as call, patch.object(backend, "ask") as tools:
                    value = backend.transcribe({"audio_path": recording.name, "smart": True})
                    self.assertEqual(value["intent"], intent)
                    self.assertEqual(value["text"], "Hello there")
                    self.assertEqual(call.call_count, 1)
                    self.assertEqual(call.call_args.args[0]["generationConfig"]["responseMimeType"], "application/json")
                    tools.assert_not_called()
            for bad in ('not json', '{"text":"Hello","intent":"send"}', '{"text":7,"intent":"ask"}', '[]'):
                response = {"candidates": [{"content": {"parts": [{"text": bad}]}}]}
                with patch.object(backend, "gemini", return_value=response), self.assertRaises(backend.BridgeError):
                    backend.transcribe({"audio_path": recording.name, "smart": True})

    def test_transcription_timing_and_custom_model_compatibility(self):
        import tempfile, json
        with tempfile.NamedTemporaryFile(suffix=".m4a") as recording:
            recording.write(b"fixture" * 30); recording.flush()
            response = {"candidates": [{"content": {"parts": [{"text": json.dumps({"text": "I love you", "intent": "dictate", "tool_request": "none"})}]}}]}
            for model in (None, "custom-model"):
                with patch.object(backend, "gemini", return_value=response) as call, patch.object(backend.time, "monotonic", side_effect=[1.0, 1.1, 2.3, 2.4]):
                    result = backend.transcribe({"audio_path": recording.name, "smart": True, "model": model})
                self.assertEqual(result["text"], "I love you")
                self.assertEqual(result["timing_ms"], {"provider": 1200, "transcription": 1400})
                config = call.call_args.args[0]["generationConfig"]
                if model is None:
                    self.assertEqual(config["thinkingConfig"], {"thinkingLevel": "minimal"})
                else:
                    self.assertNotIn("thinkingConfig", config)

    def test_generic_ask_cannot_divert_dictation_without_supported_source_request(self):
        import tempfile, json
        text = "Just give me the prompt that I would give something like Codex, please, to do this, and tell me where the file is."
        with tempfile.NamedTemporaryFile(suffix=".m4a") as recording:
            recording.write(b"fixture" * 30); recording.flush()
            for capability in (None, "none", "write_prompt", "local_files", ["web_research"]):
                parsed = {"text": text, "intent": "ask", "tool_request": capability}
                response = {"candidates": [{"content": {"parts": [{"text": json.dumps(parsed)}]}}]}
                with patch.object(backend, "gemini", return_value=response):
                    result = backend.transcribe({"audio_path": recording.name, "smart": True})
                self.assertEqual(result["intent"], "dictate")
                self.assertEqual(result["text"], text)
            for capability in ("web_research", "dataset_lookup", "email_read", "email_answer"):
                parsed = {"text": "Check the requested source", "intent": "ask", "tool_request": capability}
                response = {"candidates": [{"content": {"parts": [{"text": json.dumps(parsed)}]}}]}
                with patch.object(backend, "gemini", return_value=response):
                    self.assertEqual(backend.transcribe({"audio_path": recording.name, "smart": True})["intent"], "ask")
                parsed["intent"] = "dictate"
                response["candidates"][0]["content"]["parts"][0]["text"] = json.dumps(parsed)
                with patch.object(backend, "gemini", return_value=response):
                    self.assertEqual(backend.transcribe({"audio_path": recording.name, "smart": True})["intent"], "dictate")

    def test_command_timeout_reaps_child(self):
        import sys
        with self.assertRaises(backend.subprocess.TimeoutExpired):
            backend.run_command([sys.executable, "-c", "import time; time.sleep(10)"], timeout=0.05)
        self.assertIsNone(backend._ACTIVE_CHILD)

    def test_gmail_search_is_bounded_and_account_explicit(self):
        with patch.object(backend, "cli", return_value={"messages": [{"id": "abcdef1234567890"}]}) as cli:
            result = backend.gmail_search("workshop", "primary")
            self.assertEqual(result["messages"][0]["id"], "abcdef1234567890")
            args = cli.call_args.args[0]
            self.assertEqual(args[:4], ["gws", "primary", "gmail", "users"])
            self.assertIn('"maxResults": 5', args[-1])


class ProgressEventsTests(unittest.TestCase):
    def setUp(self):
        backend.TOOL_EVENTS.clear()

    def tearDown(self):
        backend.TOOL_EVENTS.clear()

    def test_real_call_events_are_ordered_and_private(self):
        import io, json, os
        stream = io.StringIO()
        @backend.observed("web_scrape", "Firecrawl", "Reading a page")
        def operation(secret_argument):
            self.assertIn('"status": "running"', stream.getvalue())
            return {"private_body": secret_argument}
        with patch.dict(os.environ, {"RELAY_PROGRESS": "1"}), patch.object(backend.sys, "stderr", stream):
            self.assertEqual(operation("private-sentinel"), {"private_body": "private-sentinel"})
        events = [json.loads(line) for line in stream.getvalue().splitlines()]
        self.assertEqual([e["status"] for e in events], ["running", "completed"])
        self.assertEqual(events[0]["id"], events[1]["id"])
        self.assertGreaterEqual(events[1]["duration_ms"], 0)
        self.assertNotIn("private-sentinel", stream.getvalue())
        self.assertEqual(len(backend.TOOL_EVENTS), 1)
        self.assertEqual(backend.TOOL_EVENTS[0]["status"], "completed")

    def test_failed_call_finishes_event_without_exception_contents(self):
        import io, json, os
        stream = io.StringIO()
        @backend.observed("gmail_read", "Gmail", "Reading email")
        def operation():
            raise backend.BridgeError("private-error-sentinel")
        with patch.dict(os.environ, {"RELAY_PROGRESS": "1"}), patch.object(backend.sys, "stderr", stream):
            with self.assertRaises(backend.BridgeError): operation()
        events = [json.loads(line) for line in stream.getvalue().splitlines()]
        self.assertEqual([e["status"] for e in events], ["running", "failed"])
        self.assertNotIn("private-error-sentinel", stream.getvalue())
        self.assertEqual(backend.TOOL_EVENTS[0]["status"], "failed")

    def test_progress_stream_is_opt_in(self):
        import io, os
        stream = io.StringIO()
        with patch.dict(os.environ, {"RELAY_PROGRESS": "0"}), patch.object(backend.sys, "stderr", stream):
            backend.emit_event({"status": "running"})
        self.assertEqual(stream.getvalue(), "")


class AskTraceTests(unittest.TestCase):
    def setUp(self):
        backend.TOOL_EVENTS.clear()

    def response(self, calls=None, text=None):
        parts = [{"functionCall": {"name": name, "args": args}} for name, args in (calls or [])]
        if text: parts.append({"text": text})
        return {"candidates": [{"content": {"role": "model", "parts": parts}}]}

    def test_large_plan_defers_then_finishes_without_losing_sources(self):
        calls = [("web_search", {"query": str(i)}) for i in range(5)]
        sequence = [self.response(calls), self.response(calls[3:]), self.response(text="Compared five products.")]
        def search(query, sources):
            rows = [{"url": "https://example.com/" + query + "/" + str(i), "title": query} for i in range(3)]
            sources.extend(rows)
            return {"results": rows}
        with patch.object(backend, "gemini", side_effect=sequence) as model, patch.object(backend, "web_search", side_effect=search) as search_mock:
            result = backend.ask({"text": "Compare five products"})
        self.assertEqual(search_mock.call_count, 5)
        self.assertEqual(len(result["sources"]), 15)
        responses = model.call_args_list[1].args[0]["contents"][2]["parts"]
        self.assertTrue(responses[3]["functionResponse"]["response"]["not_executed"])
        self.assertFalse(result["partial"])

    def test_total_budget_forces_supported_partial_answer(self):
        sequence = [self.response([("web_search", {"query": str(i)}) for i in range(3)]) for _ in range(3)]
        sequence.append(self.response(text="Only some items were verified."))
        with patch.object(backend, "gemini", side_effect=sequence) as model, patch.object(backend, "web_search", return_value={"results": []}) as search:
            result = backend.ask({"text": "Research many items"})
        self.assertEqual(search.call_count, 9)
        self.assertNotIn("tools", model.call_args.args[0])
        self.assertTrue(result["partial"])
        self.assertIn("budget", result["text"])

    def test_failed_page_preserves_other_evidence(self):
        sequence = [self.response([("web_scrape", {"url": "https://example.com"})]), self.response(text="Page unavailable. Not verified.")]
        with patch.object(backend, "gemini", side_effect=sequence), patch.object(backend, "web_scrape", side_effect=backend.BridgeError("HTTP 429")):
            result = backend.ask({"text": "Read this page"})
        self.assertTrue(result["ok"])
        self.assertTrue(result["partial"])
        self.assertIn("could not be read", result["text"])

    def test_sources_deduplicated_and_cited_first(self):
        sources = [{"url": "https://example.com/" + str(i)} for i in range(15)]
        result = backend.answer_sources(sources + sources, "See https://example.com/14 for details.")
        self.assertEqual(len(result), 15)
        self.assertEqual(result[0]["url"], sources[-1]["url"])

    def test_evidence_requires_retrieved_quote_and_no_added_numbers(self):
        import json
        url = "https://example.com/pricing"
        quote = "The Mac license costs $25 once."
        items = [
            {"label": "Price", "value": "$25 once", "url": url, "quote": quote},
            {"label": "Invented discount", "value": "$20", "url": url, "quote": quote},
            {"label": "Invented passage", "value": "Offline", "url": url, "quote": "Always works offline."},
            {"label": "Invented source", "value": "$25 once", "url": "https://other.example", "quote": quote},
        ]
        result = self.response(text=json.dumps({"sections": [{"title": "Example", "official_domain": "example.com", "items": items}]}))
        with patch.object(backend, "gemini", return_value=result):
            answer, receipts, missing = backend.grounded_web_answer("Compare", "Draft", {url: quote}, backend.TEXT_MODEL)
        self.assertEqual(len(receipts), 1)
        self.assertEqual(answer.count("Not verified"), 3)
        self.assertTrue(missing)

    def test_malformed_evidence_fails_closed(self):
        with patch.object(backend, "gemini", return_value=self.response(text="not JSON")):
            answer, receipts, missing = backend.grounded_web_answer("Compare", "Draft", {}, backend.TEXT_MODEL)
        self.assertEqual(receipts, [])
        self.assertTrue(missing)
        self.assertIn("not verified", answer)

    def test_competitor_and_review_pages_cannot_verify_product_prices(self):
        import json
        quote = "The price is $25 once."
        for domain, url in [("example.com", "https://reviewer.com/example"), ("reviewer.com", "https://reviewer.com/example")]:
            payload = {"sections": [{"title": "Example", "official_domain": domain, "items": [{"label": "Price", "value": "$25", "url": url, "quote": quote}]}]}
            with patch.object(backend, "gemini", return_value=self.response(text=json.dumps(payload))):
                answer, receipts, missing = backend.grounded_web_answer("Compare pricing", "Draft", {url: quote}, backend.TEXT_MODEL)
            self.assertEqual(receipts, [])
            self.assertTrue(missing)

    def test_empty_search_arguments_use_original_request(self):
        with patch.object(backend, "gemini", side_effect=[self.response([("web_search", {})]), self.response(text="No sources found.")]), patch.object(backend, "web_search", return_value={"results": []}) as search:
            backend.ask({"text": "Research voice apps"})
        self.assertEqual(search.call_args.args[0], "Research voice apps")

    def test_passage_id_must_belong_to_cited_page(self):
        import json
        a, b = "https://example.com/a", "https://example.com/b"
        item = {"label": "Price", "value": "$25", "url": b, "passage_id": "p0"}
        response = self.response(text=json.dumps({"sections": [{"title": "Example", "official_domain": "example.com", "items": [item]}]}))
        with patch.object(backend, "gemini", return_value=response):
            answer, receipts, missing = backend.grounded_web_answer("Compare pricing", "Draft", {a: "Price is $25.", b: "Price is $99."}, backend.TEXT_MODEL)
        self.assertEqual(receipts, [])
        self.assertTrue(missing)

    def test_ordinary_dataset_request_discovers_without_executing_provider(self):
        sequence = [self.response([("dataset_discover", {"query": "annual country population"}), ("web_search", {"query": "World Bank population dataset"})]), self.response(text="Public source found. Discovery did not retrieve a dataset.")]
        with patch.object(backend, "gemini", side_effect=sequence), patch.object(backend, "firecrawl", side_effect=[{"data": {"tools": [{"provider": "public", "capability": "read", "description": "public data"}]}}, {"data": {"web": [{"url": "https://data.worldbank.org/", "title": "World Bank"}]}}]) as fc:
            result = backend.ask({"text": "Find a public dataset for annual population by country and show its source"})
        self.assertEqual([call.args[0] for call in fc.call_args_list], ["search", "search"])
        self.assertEqual(fc.call_args_list[0].args[1]["sources"], ["alexandria"])
        self.assertEqual([e["provider"] for e in backend.TOOL_EVENTS], ["Relay", "Alexandria", "Firecrawl", "Relay"])
        self.assertEqual(backend.TOOL_EVENTS[1]["input"], {"query": "annual country population"})
        self.assertIn("no dataset executed", backend.TOOL_EVENTS[1]["summary"])
        self.assertEqual(result["sources"][-1]["url"], "https://data.worldbank.org/")

    def test_gmail_connection_search_read_sequence_has_no_mail_body_in_trace(self):
        import json
        sequence = [self.response([("gmail_search", {"query": "subject:workshop"})]), self.response([("gmail_read", {"message_id": "abcdef1234567890"})]), self.response(text="Test-only workshop fixture found.")]
        fixtures = [{"emailAddress": "fixture@example.test"}, {"messages": [{"id": "abcdef1234567890"}]}, {"snippet": "private-body-sentinel", "payload": {"headers": [{"name": "Subject", "value": "private-subject-sentinel"}]}}]
        with patch.object(backend, "gemini", side_effect=sequence), patch.object(backend, "cli", side_effect=fixtures) as cli:
            backend.ask({"text": "Look in my Gmail for the workshop email", "account": "personal"})
        self.assertEqual([e["provider"] for e in backend.TOOL_EVENTS], ["Relay", "Google", "Gmail", "Relay", "Gmail", "Relay"])
        self.assertEqual(cli.call_args_list[0].args[0][4], "getProfile")
        self.assertTrue(all(c.args[0][1] == "personal" for c in cli.call_args_list))
        trace = json.dumps(backend.TOOL_EVENTS)
        for private in ("private-body-sentinel", "private-subject-sentinel", "fixture@example.test"):
            self.assertNotIn(private, trace)

    def test_failed_connection_prevents_mailbox_search(self):
        with patch.object(backend, "gemini", return_value=self.response([("gmail_search", {"query": "workshop"})])), patch.object(backend, "cli", side_effect=backend.BridgeError("Connection failed")), patch.object(backend, "gmail_search") as search:
            with self.assertRaises(backend.BridgeError): backend.ask({"text": "Find my workshop email"})
        search.assert_not_called()
        self.assertEqual(backend.TOOL_EVENTS[-1]["provider"], "Google")
        self.assertEqual(backend.TOOL_EVENTS[-1]["status"], "failed")

    def test_repeated_search_checks_connection_once(self):
        with patch.object(backend, "gemini", side_effect=[self.response([("gmail_search", {"query": "one"}), ("gmail_search", {"query": "two"})]), self.response(text="No matches")]), patch.object(backend, "google_connection") as connection, patch.object(backend, "gmail_search", return_value={"messages": []}):
            backend.ask({"text": "Find my mail"})
        connection.assert_called_once_with("primary")

    def test_world_bank_bounds(self):
        self.assertEqual(backend.dataset_options("SP.POP.TOTL", ["CAN"], "2023:2024")["per_page"], 50)
        for args in [("OTHER", ["CAN"], "2024"), ("SP.POP.TOTL", ["ALL"], "2024"), ("SP.POP.TOTL", ["CAN"]*4, "2024"), ("SP.POP.TOTL", ["CAN"], "2000:2024")]:
            with self.assertRaises(backend.BridgeError): backend.dataset_options(*args)

    def test_world_bank_price_change_stops_execution(self):
        schema = {"data": {"alexandria": [{"provider": "firecrawl", "capability": "find-tools", "data": {"items": [{**backend.WORLD_BANK, "creditsCost": 6, "perRecord": False}]}}]}}
        with patch.object(backend, "firecrawl", return_value=schema) as fc:
            with self.assertRaisesRegex(backend.BridgeError, "price changed"): backend.dataset_inspect()
        self.assertEqual(fc.call_count, 1)
        self.assertEqual(backend.TOOL_EVENTS[-1]["status"], "failed")

    def test_world_bank_preserves_null_and_never_paginates(self):
        data = {"data": {"alexandria": [{**backend.WORLD_BANK, "data": {"records": [{"value": None, "date": "2024", "country_name": "Canada"}], "source_url": "https://api.worldbank.org/v2/country/CAN/indicator/SP.POP.TOTL", "next_page": 2}}]}}
        sources=[]
        with patch.object(backend, "firecrawl", return_value=data) as fc:
            result=backend.dataset_read(backend.dataset_options("SP.POP.TOTL", ["CAN"], "2024"), sources)
        self.assertIsNone(result["records"][0]["value"])
        self.assertTrue(result["has_more"])
        self.assertEqual(fc.call_count, 1)
        self.assertEqual(len(sources), 1)

    def test_world_bank_request_executes_once(self):
        args={"indicator_id": "SP.POP.TOTL", "country_codes": ["CAN"], "date": "2024"}
        with patch.object(backend, "gemini", side_effect=[self.response([("dataset_read", args), ("dataset_read", args)]), self.response(text="One result")]), patch.object(backend, "dataset_inspect"), patch.object(backend, "dataset_read", return_value={"records": []}) as read:
            backend.ask({"text": "Get Canada's 2024 population"})
        self.assertEqual(read.call_count, 1)

    def test_trace_redacts_credentials_and_excludes_thought_text(self):
        self.assertEqual(backend.trace_text("https://example.com/?token=secret&year=2025"), "https://example.com/?token=[redacted]&year=2025")
        self.assertEqual(backend.parts_text([{"thought": True, "text": "hidden"}, {"text": "answer"}]), "answer")


if __name__ == "__main__":
    unittest.main()
