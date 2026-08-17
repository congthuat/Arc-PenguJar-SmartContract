"use client";

import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { arcTestnet } from "viem/chains";
import { useConnection, usePublicClient, useSendTransaction, useWriteContract } from "wagmi";
import { useVerifiedWalletChain } from "@/hooks/useVerifiedWalletChain";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import { erc20BalanceAbi } from "@/lib/abi/erc20";
import { formatAssetAmount, getAssetById, parseAssetAmount, SUPPORTED_ASSETS, type SupportedAssetId } from "@/lib/assets";
import { ARC_EXPLORER_URL } from "@/lib/config";
import { classifyWalletFailure } from "@/lib/walletSafety";
import { isSwapQuoteFresh, oppositeAssetId, SWAP_SLIPPAGE_OPTIONS, type SwapQuote } from "@/lib/swap";

type Props = { locale: "en" | "vi"; onBusyChange(busy: boolean): void };

export function RealSwapFlow({ locale, onBusyChange }: Props) {
  const vi = locale === "vi";
  const connection = useConnection();
  const chain = useVerifiedWalletChain();
  const client = usePublicClient({ chainId: arcTestnet.id });
  const writer = useWriteContract();
  const sender = useSendTransaction();
  const balances = useWalletBalances(connection.address, chain.isArc);
  const [fromId, setFromId] = useState<SupportedAssetId>("usdc");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState<(typeof SWAP_SLIPPAGE_OPTIONS)[number]>(0.005);
  const [quote, setQuote] = useState<SwapQuote>();
  const [reviewing, setReviewing] = useState(false);
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<{ hash: Hex; quote: SwapQuote }>();

  useEffect(() => onBusyChange(Boolean(pending)), [onBusyChange, pending]);

  const from = getAssetById(fromId)!;
  const to = getAssetById(oppositeAssetId(fromId))!;
  const balance = balances.assets[fromId].data ?? 0n;
  const parsed = parseAssetAmount(amount, from);

  function resetInput() {
    setAmount(""); setQuote(undefined); setReviewing(false); setError(undefined); setSuccess(undefined);
  }

  async function review() {
    if (!connection.address || !parsed) return setError(vi ? "Nhập số tiền hợp lệ." : "Enter a valid amount.");
    if (parsed > balance) return setError(vi ? "Số dư không đủ." : "Insufficient balance.");
    setPending(vi ? "Đang lấy báo giá trực tiếp trên Arc…" : "Loading a live Arc quote…");
    setError(undefined); setQuote(undefined);
    try {
      const params = new URLSearchParams({ from: from.id, to: to.id, amount: parsed.toString(), address: connection.address, slippage: String(slippage) });
      const response = await fetch(`/api/swap-quote?${params}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as SwapQuote | { error?: string };
      if (!response.ok || !("transactionRequest" in payload)) throw new Error("error" in payload && payload.error ? payload.error : "No executable route.");
      setQuote(payload); setReviewing(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (vi ? "Không lấy được báo giá." : "Could not load a quote."));
    } finally { setPending(undefined); }
  }

  async function execute() {
    if (!connection.address || !client || !quote || pending) return;
    if (!isSwapQuoteFresh(quote.quotedAt)) { setQuote(undefined); setReviewing(false); return setError(vi ? "Báo giá đã hết hạn. Hãy lấy báo giá mới." : "Quote expired. Get a fresh quote."); }
    if (quote.fromAssetId !== from.id || quote.toAssetId !== to.id || quote.transactionRequest.chainId !== arcTestnet.id || quote.transactionRequest.from.toLowerCase() !== connection.address.toLowerCase()) return setError(vi ? "Báo giá không khớp và đã bị chặn." : "Quote mismatch was blocked.");

    let submitted = false;
    setError(undefined);
    try {
      if (!(await chain.verifyNow())) throw new Error("arc");
      const sellAmount = BigInt(quote.fromAmount);
      const freshBalance = await client.readContract({ address: from.address, abi: erc20BalanceAbi, functionName: "balanceOf", args: [connection.address] });
      if (sellAmount > freshBalance) throw new Error("balance");
      const allowance = await client.readContract({ address: from.address, abi: erc20BalanceAbi, functionName: "allowance", args: [connection.address, quote.approvalAddress] });
      if (allowance < sellAmount) {
        setPending(vi ? "Đang chờ approve đúng số lượng trong ví…" : "Waiting for exact token approval…");
        await client.simulateContract({ address: from.address, abi: erc20BalanceAbi, functionName: "approve", args: [quote.approvalAddress, sellAmount], account: connection.address });
        const approvalHash = await writer.writeContractAsync({ address: from.address, abi: erc20BalanceAbi, functionName: "approve", args: [quote.approvalAddress, sellAmount], account: connection.address, chainId: arcTestnet.id });
        const approvalReceipt = await client.waitForTransactionReceipt({ hash: approvalHash });
        if (approvalReceipt.status !== "success") throw new Error("approve");
      }
      if (!isSwapQuoteFresh(quote.quotedAt)) { setQuote(undefined); setReviewing(false); return setError(vi ? "Approve xong nhưng báo giá đã hết hạn. Không gửi swap; hãy lấy báo giá mới." : "Approval succeeded, but the quote expired. No swap was sent; get a fresh quote."); }
      if (!(await chain.verifyNow())) throw new Error("arc");
      const submissionBalance = await client.readContract({ address: from.address, abi: erc20BalanceAbi, functionName: "balanceOf", args: [connection.address] });
      if (sellAmount > submissionBalance) throw new Error("balance");
      setPending(vi ? "Đang chờ bạn xác nhận swap trong ví…" : "Waiting for swap confirmation in your wallet…");
      const gas = await client.estimateGas({ account: connection.address, to: quote.transactionRequest.to, data: quote.transactionRequest.data, value: 0n });
      const hash = await sender.sendTransactionAsync({ account: connection.address, chainId: arcTestnet.id, to: quote.transactionRequest.to, data: quote.transactionRequest.data, value: 0n, gas: (gas * 115n) / 100n });
      submitted = true; setPending(vi ? "Đã gửi. Đang chờ Arc xác nhận…" : "Submitted. Waiting for Arc confirmation…");
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("revert");
      await Promise.all([balances.usdc.refetch(), balances.eurc.refetch()]);
      setSuccess({ hash, quote }); setReviewing(false);
    } catch (caught) {
      if (caught instanceof Error && caught.message === "arc") return setError(vi ? "Cần kết nối Arc Testnet." : "Arc Testnet is required.");
      if (caught instanceof Error && caught.message === "balance") return setError(vi ? "Số dư vừa thay đổi và không còn đủ." : "Your balance changed and is no longer sufficient.");
      const kind = classifyWalletFailure(caught, submitted);
      const messages = {
        rejected: vi ? "Bạn đã từ chối yêu cầu trong ví." : "You rejected the wallet request.",
        "wrong-network": vi ? "Ví không còn ở Arc Testnet." : "Your wallet is no longer on Arc Testnet.",
        "insufficient-gas": vi ? "Không đủ USDC để trả gas trên Arc." : "Not enough USDC to pay Arc gas.",
        reverted: vi ? "Giao dịch bị revert." : "The transaction reverted.",
        "confirmation-unknown": vi ? "Giao dịch đã gửi nhưng trạng thái xác nhận chưa rõ. Hãy kiểm tra ArcScan trước khi thử lại." : "Transaction was submitted but confirmation is unclear. Check ArcScan before retrying.",
        rpc: vi ? "Ví hoặc RPC đang gặp lỗi. Hãy thử lại với báo giá mới." : "The wallet or RPC failed. Retry with a fresh quote.",
      } as const;
      setError(messages[kind]);
    } finally { setPending(undefined); }
  }

  if (success) {
    const sold = getAssetById(success.quote.fromAssetId)!;
    const bought = getAssetById(success.quote.toAssetId)!;
    return <div className="transaction-state"><span>✓</span><h3>{vi ? "Hoán đổi thành công" : "Swap confirmed"}</h3><p>{formatAssetAmount(BigInt(success.quote.fromAmount), sold)} {sold.symbol} → ≈ {formatAssetAmount(BigInt(success.quote.toAmount), bought)} {bought.symbol}</p><a href={`${ARC_EXPLORER_URL}/tx/${success.hash}`} target="_blank" rel="noreferrer">ArcScan ↗</a><button type="button" className="standalone-action" onClick={resetInput}>{vi ? "Hoán đổi tiếp" : "Swap again"}</button></div>;
  }

  if (reviewing && quote) return <div className="wallet-flow"><h3>{vi ? "Kiểm tra hoán đổi" : "Review swap"}</h3><dl className="wallet-review"><div><dt>{vi ? "Bán" : "Sell"}</dt><dd>{formatAssetAmount(BigInt(quote.fromAmount), from)} {from.symbol}</dd></div><div><dt>{vi ? "Ước tính nhận" : "Estimated receive"}</dt><dd>≈ {formatAssetAmount(BigInt(quote.toAmount), to)} {to.symbol}</dd></div><div><dt>{vi ? "Tối thiểu" : "Minimum receive"}</dt><dd>{formatAssetAmount(BigInt(quote.toAmountMin), to)} {to.symbol}</dd></div><div><dt>Route</dt><dd>LI.FI · {quote.toolName}</dd></div><div><dt>Slippage</dt><dd>{(slippage * 100).toFixed(1)}%</dd></div><div><dt>{vi ? "Mạng" : "Network"}</dt><dd>Arc Testnet · 5042002</dd></div></dl><p className="wallet-notice">{vi ? "Báo giá có thời hạn ngắn. Makoto chỉ approve đúng số lượng cần thiết; giao dịch cuối luôn do ví của bạn ký." : "Quotes are short-lived. Makoto approves only the exact required amount; your wallet always signs the final transaction."}</p>{pending && <p className="transaction-progress" role="status">{pending}</p>}{error && <p className="field-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-action" onClick={() => { setReviewing(false); setQuote(undefined); setError(undefined); }} disabled={Boolean(pending)}>{vi ? "Quay lại" : "Back"}</button><button type="button" className="primary-action" onClick={() => void execute()} disabled={Boolean(pending) || !chain.isArc}>{vi ? "Xác nhận trong ví" : "Confirm in wallet"}</button></div></div>;

  return <form className="create-form wallet-flow" onSubmit={(event) => { event.preventDefault(); void review(); }}><label>{vi ? "Tài sản bán" : "Sell asset"}<select className="asset-selector" value={fromId} onChange={(event) => { setFromId(event.target.value as SupportedAssetId); resetInput(); }}>{SUPPORTED_ASSETS.map((asset) => <option key={asset.id} value={asset.id}>{asset.symbol} · {asset.name}</option>)}</select></label><label>{vi ? "Tài sản nhận" : "Buy asset"}<select className="asset-selector" value={to.id} disabled><option>{to.symbol} · {to.name}</option></select></label><label>{vi ? "Số lượng" : "Amount"}<div className="wallet-field-with-action amount"><input inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setQuote(undefined); setError(undefined); }} placeholder="0.00" /><span>{from.symbol}</span><button type="button" onClick={() => setAmount(formatAssetAmount(balance, from))}>MAX</button></div><small>{vi ? "Khả dụng" : "Available"}: {formatAssetAmount(balance, from)} {from.symbol}</small></label><label>Slippage<select className="asset-selector" value={slippage} onChange={(event) => setSlippage(Number(event.target.value) as (typeof SWAP_SLIPPAGE_OPTIONS)[number])}>{SWAP_SLIPPAGE_OPTIONS.map((value) => <option key={value} value={value}>{(value * 100).toFixed(1)}%</option>)}</select></label><p className="wallet-notice">{vi ? "Swap thật trên Arc Testnet. Báo giá lấy qua LI.FI; Makoto không giữ private key." : "Real Arc Testnet swap. Quotes are routed through LI.FI; Makoto never holds your private key."}</p>{pending && <p className="transaction-progress" role="status">{pending}</p>}{error && <p className="field-error" role="alert">{error}</p>}{!chain.isArc && <p className="field-error">{vi ? "Cần kết nối Arc Testnet." : "Arc Testnet is required."}</p>}<div className="modal-actions"><button type="submit" className="primary-action" disabled={Boolean(pending) || !chain.isArc}>{vi ? "Lấy báo giá" : "Get quote"}</button></div></form>;
}
