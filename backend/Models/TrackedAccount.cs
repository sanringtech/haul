namespace UsageMonitor.Desktop.Models;

/// <summary>
/// One tracked account (憲法 §6「帳號」). Multiple accounts can share the same <see cref="SourceId"/>
/// (e.g. two DeepSeek API keys) — <see cref="AccountId"/> is what's actually unique, and is what
/// <see cref="Security.ISecretStore"/> keys off instead of the bare source id.
/// </summary>
public sealed record TrackedAccount(string AccountId, string SourceId, string? Label);
