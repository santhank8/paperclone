import json

from crca_q.schemas import RunInput


def test_run_input_from_context():
    ctx = json.loads(
        json.dumps(
            {
                "companyId": "c1",
                "agentId": "a1",
                "heartbeatRunId": "r1",
                "issueId": "i1",
                "wakeReason": "schedule",
            }
        )
    )
    inp = RunInput.from_context_dict(ctx)
    assert inp.company_id == "c1"
    assert inp.agent_id == "a1"
    assert inp.heartbeat_run_id == "r1"
    assert inp.issue_id == "i1"
    assert inp.wake_reason == "schedule"
