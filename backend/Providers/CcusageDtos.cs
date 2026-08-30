namespace UsageMonitor.Desktop.Providers;

/// <summary>Minimal subset of `ccusage blocks --json` output actually consumed here.</summary>
internal sealed class CcusageBlocksResponse
{
    public List<CcusageBlock> Blocks { get; set; } = [];
}

internal sealed class CcusageBlock
{
    public bool IsActive { get; set; }
    public string StartTime { get; set; } = "";
    public string EndTime { get; set; } = "";
    public double TotalTokens { get; set; }
    public CcusageTokenLimitStatus? TokenLimitStatus { get; set; }
}

internal sealed class CcusageTokenLimitStatus
{
    public int Limit { get; set; }
    public double PercentUsed { get; set; }
    public string Status { get; set; } = "";
}
