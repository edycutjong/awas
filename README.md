# Awas

*Awas* is Indonesian for "watch out". Paste a job offer; Awas builds an evidence file in which every line is a URL
plus a verbatim quote that code has verified against the fetched page, then says **STOP** or **VERIFY FIRST** before
anyone boards.

Built with Nebius Token Factory (NVIDIA Nemotron), Tavily and Nebius Object Storage for the Nebius Global AI Hackathon.
The Nebius client libraries in `src/lib/nebius/` (SigV4, Object Storage, service-account auth, Serverless Jobs) are
copied from the same author's earlier project, faultline.

Work in progress — this README is rewritten once the benchmark numbers exist.

License: MIT.
