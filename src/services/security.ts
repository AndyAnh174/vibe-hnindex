/** Bounded, source-backed review signals. Matches are leads, never vulnerability verdicts. */
export const SECURITY_CATEGORIES = ['authentication', 'authorization', 'injection', 'command_execution', 'xss', 'ssrf', 'path_traversal', 'deserialization', 'crypto', 'secrets', 'configuration', 'dependencies'] as const;
export type SecurityCategory = typeof SECURITY_CATEGORIES[number];
export interface SecurityRule {
  id: string; category: SecurityCategory; cwe: string; title: string;
  pattern: RegExp; priority: number; kind: 'candidate' | 'surface'; validation: string[];
}
export const SECURITY_RULES: SecurityRule[] = [
  { id:'sql-concat', category:'injection', cwe:'CWE-89', title:'SQL statement assembled with interpolation/concatenation', pattern:/\b(?:SELECT|INSERT|UPDATE|DELETE)\b.*(?:\$\{|["'`]\s*\+|%\s*[\w(]|\.format\s*\()/i, priority:80, kind:'candidate', validation:['Trace each interpolated value to its input and any parameter binding.', 'Add a regression test that treats input as data and verifies query parameters.'] },
  { id:'shell', category:'command_execution', cwe:'CWE-78', title:'Shell or dynamic code execution boundary', pattern:/\b(?:eval|exec|execSync|os\.system)\s*\(|shell\s*[:=]\s*(?:true|True)\b/, priority:90, kind:'candidate', validation:['Trace command/code input and check whether a shell interprets it.', 'Use a sandboxed test with harmless input; verify argument separation and allowlists.'] },
  { id:'html', category:'xss', cwe:'CWE-79', title:'HTML rendering sink', pattern:/dangerouslySetInnerHTML|\.innerHTML\s*=|\b(?:mark_safe|Html\.Raw)\s*\(/, priority:80, kind:'candidate', validation:['Trace HTML provenance and sanitization through the rendering boundary.', 'Add a browser regression test asserting untrusted markup cannot execute.'] },
  { id:'outbound', category:'ssrf', cwe:'CWE-918', title:'Outbound request boundary', pattern:/\b(?:fetch|requests\.(?:get|post)|axios\.(?:get|post)|httpx\.(?:get|post))\s*\(/, priority:65, kind:'candidate', validation:['Trace URL, redirects, DNS resolution and destination allowlists.', 'Use a controlled local HTTP fixture to verify restricted destinations and redirect handling.'] },
  { id:'file-access', category:'path_traversal', cwe:'CWE-22', title:'Filesystem access boundary', pattern:/\b(?:readFile(?:Sync)?|writeFile(?:Sync)?|sendFile|send_file|open|extractall)\s*\(/, priority:65, kind:'candidate', validation:['Trace filename/archive entries and verify canonical paths remain inside the intended root.', 'Add a temporary-directory test covering parent traversal and symlink escape.'] },
  { id:'deserialize', category:'deserialization', cwe:'CWE-502', title:'Potentially unsafe object deserialization', pattern:/\b(?:pickle\.loads?|yaml\.load|unserialize|ObjectInputStream)\s*\(/, priority:85, kind:'candidate', validation:['Determine whether serialized bytes can be attacker-controlled and which constructors are enabled.', 'Verify a safe parser/schema with a benign malformed-input regression test.'] },
  { id:'weak-crypto', category:'crypto', cwe:'CWE-327', title:'Weak algorithm or disabled token verification', pattern:/\b(?:md5|sha1)\s*\(|createHash\s*\(\s*["'](?:md5|sha1)["']|verify_signature["']?\s*[:=]\s*(?:false|False)/i, priority:75, kind:'candidate', validation:['Identify the security purpose; non-security checksums are not vulnerabilities.', 'Verify appropriate password hashing, token signature/algorithm checks or integrity protection.'] },
  { id:'credential', category:'secrets', cwe:'CWE-798', title:'Credential-like literal (value redacted)', pattern:/(?:api[_-]?key|secret|password|access[_-]?token)\s*[:=]\s*["'][^"'\r\n]{8,}["']|\b(?:sk-[\w-]{20,}|AKIA[A-Z0-9]{16}|gh[pousr]_[\w]{20,})\b|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i, priority:100, kind:'candidate', validation:['Check locally whether the value is an example/fixture or a deployed credential; do not reveal it.', 'For a real exposed credential, rotate/revoke it and replace literals with secret injection.'] },
  { id:'debug-tls', category:'configuration', cwe:'CWE-16', title:'Debug or transport verification override', pattern:/\bDEBUG\s*[:=]\s*(?:true|True)|rejectUnauthorized\s*:\s*false|verify\s*=\s*False|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0/, priority:75, kind:'candidate', validation:['Check the effective deployed configuration, environment overrides and trust boundary.', 'Assert secure production defaults and explicit local-development opt-ins.'] },
  { id:'auth', category:'authentication', cwe:'CWE-287', title:'Authentication/session entry point', pattern:/\b(?:login|authenticate|verifyToken|requireAuth|jwt\.verify|check_password|set_cookie)\s*\(/i, priority:60, kind:'surface', validation:['Map token/session creation, verification, expiry and recovery flows.', 'Test invalid, expired and revoked credentials and rate limits with owned test accounts.'] },
  { id:'route', category:'authorization', cwe:'CWE-862', title:'Route or access-control boundary', pattern:/\b(?:app|router)\.(?:get|post|put|patch|delete|use)\s*\(|permission_classes|has_permission|IsAuthenticated|@(?:login_required|permission_required)/, priority:60, kind:'surface', validation:['Trace caller identity, role, tenant and object ownership from route to data access.', 'Use two owned test accounts to verify denied cross-user/tenant access and privileged actions.'] },
  { id:'dependency', category:'dependencies', cwe:'CWE-1395', title:'Dependency manifest for version/advisory review', pattern:/["'](?:dependencies|devDependencies)["']\s*:|^\s*[\w.-]+\s*(?:==|>=|~=)/, priority:40, kind:'surface', validation:['Resolve installed versions from lockfiles and compare with current authoritative advisories.', 'Assess reachability and configuration before assigning a finding; this tool does not query advisory feeds.'] },
];

/** Best-effort redaction before output AND before any optional external reranking. */
export function redactSecurityText(text: string): string {
  return text
    .replace(/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z ]+ )?PRIVATE KEY-----|$)/g, match => match.split('\n').map(()=>'[REDACTED PRIVATE KEY]').join('\n'))
    .replace(/\b(?:sk-[\w-]{20,}|gh[pousr]_[\w]{20,}|AKIA[A-Z0-9]{16}|eyJ[\w-]+\.[\w-]+\.[\w-]+)\b/g, '[REDACTED]')
    .replace(/(\b\w*(?:password|passwd|secret|api[_-]?key|access[_-]?token|authorization)\w*["']?\s*[:=]\s*)(["'`])[^"'`\r\n]*\2/gi, '$1"[REDACTED]"')
    .replace(/^(\s*[\w.-]*(?:password|passwd|secret|api[_-]?key|access[_-]?token|authorization)[\w.-]*\s*[:=]\s*)(?!["'`])[^\r\n]+/gim, '$1[REDACTED]')
    .replace(/(\bBearer\s+)[\w.+/=-]+/gi, '$1[REDACTED]')
    .replace(/(\w+:\/\/)[^\s/:@]+:[^\s/@]+@/g, '$1[REDACTED]@');
}

export function hasUnquotedCredential(line: string): boolean {
  return /^\s*[\w.-]*(?:password|passwd|secret|api[_-]?key|access[_-]?token)[\w.-]*\s*[:=]\s*[^\s"'`]{8,}/i.test(line);
}
