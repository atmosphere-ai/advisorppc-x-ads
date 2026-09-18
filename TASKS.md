# Launch checklist — `advisorppc-x-ads`

## Ready for users (0.3.0)

- [x] Scheduler module export `@advisorppc/x-ads/schedule`
- [x] HTTP auto-start worker + `npm run worker`
- [x] Vendor self-setup (Claude / ChatGPT / Cursor / Grok / AdvisorPPC)
- [x] Agents: publish_queue, analytics_digest, paused_audit, health
- [x] 51 tools, tests, typecheck
- [ ] Pushed `v0.3.0` / CI green

### Known limits

- X Ads still has no native schedule; this is AdvisorPPC's queue.
- Worker fires with env token, not per-request Bearer.
- Digests never auto-resume spend.
- App event tags, tracking-partner tags, app lists, tweet previews still not wrapped.
- Lives under `atmosphere-ai` until `advisorppc-org` can host.
