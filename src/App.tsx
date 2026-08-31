import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AuthError,
  MissingIdentityError,
  getUser,
  handleAuthCallback,
  login,
  logout,
  onAuthChange,
  requestPasswordRecovery,
  signup,
  updateUser,
  type User,
} from "@netlify/identity";
import { fetchWishes, saveWishes } from "./api";
import {
  calculateWishStats,
  createWish,
  extractWishName,
  getSwipeDirection,
  parsePriority,
  type Wish,
  type WishDraft,
  type WishPriority,
  type WishStatus,
} from "./domain";

type View = "home" | "wishes";
type Filter = "all" | WishStatus;
type ChatMode = "idle" | "add-name" | "add-reason" | "add-price" | "add-priority" | "confirm-add" | "choose-purchase" | "confirm-purchase";
type ChatMessage = { id: string; role: "assistant" | "user"; text: string };
type Reply = { label: string; action: string; value?: string; confirm?: boolean };

const welcomeMessage = "こんにちは。欲しいものの追加や、買えたものの報告をお手伝いします。今日はどうしますか？";
const mainReplies: Reply[] = [
  { label: "＋ 欲しいものを追加", action: "start-add" },
  { label: "✓ 買えたものを報告", action: "start-purchase" },
  { label: "リストを見る", action: "view-list" },
];

function errorMessage(error: unknown) {
  if (error instanceof MissingIdentityError) return "この機能はNetlifyの公開環境で利用できます。";
  if (error instanceof AuthError) {
    if (error.status === 401) return "メールアドレスまたはパスワードが違います。";
    if (error.status === 403) return "現在、新規登録を受け付けていません。";
    if (error.status === 404) return "認証機能はNetlifyの公開環境で利用できます。";
    if (error.status === 422) return "入力内容を確認してください。パスワードは8文字以上にしてください。";
    return error.message;
  }
  return error instanceof Error ? error.message : "処理に失敗しました。";
}

function SplashScreen() {
  return <main className="auth-shell"><div className="auth-card splash-card"><span className="brand-mark">A</span><h1>アシスター</h1><p>準備しています…</p></div></main>;
}

function AuthScreen({ notice, onAuthenticated }: { notice: string; onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(notice);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "login") {
        onAuthenticated(await login(email.trim(), password));
      } else {
        const user = await signup(email.trim(), password, { full_name: name.trim() });
        if (user.confirmedAt) onAuthenticated(user);
        else setMessage("確認メールを送りました。メール内のリンクを開いて登録を完了してください。");
      }
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function recover() {
    if (!email.trim()) return setMessage("先にメールアドレスを入力してください。");
    setBusy(true);
    try {
      await requestPasswordRecovery(email.trim());
      setMessage("パスワード再設定メールを送りました。");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-shell">
    <section className="auth-card">
      <div className="auth-brand"><span className="brand-mark">A</span><div><strong>アシスター</strong><small>欲しいものを、ひとつずつ。</small></div></div>
      <div className="auth-character" aria-hidden="true">A</div>
      <div className="auth-copy"><h1>{mode === "login" ? "おかえりなさい" : "はじめまして"}</h1><p>{mode === "login" ? "続きから始めましょう。" : "あなた専用のリストをつくります。"}</p></div>
      <div className="auth-tabs" role="tablist">
        <button className={mode === "login" ? "is-active" : ""} type="button" onClick={() => { setMode("login"); setMessage(""); }}>ログイン</button>
        <button className={mode === "signup" ? "is-active" : ""} type="button" onClick={() => { setMode("signup"); setMessage(""); }}>新規登録</button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        {mode === "signup" && <label>お名前<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={40} autoComplete="name" /></label>}
        <label>メールアドレス<input value={email} onChange={(event) => setEmail(event.target.value)} required type="email" autoComplete="email" /></label>
        <label>パスワード<input value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        {message && <p className="auth-message" role="status">{message}</p>}
        <button className="primary-button auth-submit" disabled={busy} type="submit">{busy ? "処理中…" : mode === "login" ? "ログイン" : "登録する"}</button>
        {mode === "login" && <button className="text-button" disabled={busy} type="button" onClick={recover}>パスワードを忘れた方</button>}
      </form>
    </section>
  </main>;
}

function RecoveryScreen({ user, onComplete }: { user: User; onComplete: (user: User) => void }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      onComplete(await updateUser({ password }));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return <main className="auth-shell"><section className="auth-card compact-auth"><span className="brand-mark">A</span><h1>新しいパスワード</h1><p>{user.email}</p><form className="auth-form" onSubmit={submit}><label>パスワード<input type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{message && <p className="auth-message">{message}</p>}<button className="primary-button auth-submit" disabled={busy}>更新する</button></form></section></main>;
}

function Character({ happy, onClick }: { happy: boolean; onClick: () => void }) {
  return <button className="character-trigger" type="button" aria-label="アシスターに話しかける" onClick={onClick}>
    <span className="tap-hint">タップして話しかける</span>
    <span className="character-wrap" aria-hidden="true"><span className="character-shadow" /><span className={`character${happy ? " is-happy" : ""}`}><span className="antenna"><i /></span><span className="character-face"><span className="eye eye-left" /><span className="eye eye-right" /><span className="cheek cheek-left" /><span className="cheek cheek-right" /><span className="mouth" /></span><span className="character-badge">A</span></span></span>
  </button>;
}

function Conversation({ wishes, onAdd, onPurchase, onViewList, chatOpen, onCloseChat, homeVisible }: {
  wishes: Wish[];
  onAdd: (draft: WishDraft) => void;
  onPurchase: (id: string) => void;
  onViewList: () => void;
  chatOpen: boolean;
  onCloseChat: () => void;
  homeVisible: boolean;
}) {
  const [mode, setMode] = useState<ChatMode>("idle");
  const [draft, setDraft] = useState<Partial<WishDraft>>({});
  const [pendingPurchaseId, setPendingPurchaseId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: crypto.randomUUID(), role: "assistant", text: welcomeMessage }]);
  const [bubble, setBubble] = useState(welcomeMessage);
  const [replies, setReplies] = useState<Reply[]>(mainReplies);
  const [homeInput, setHomeInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [tapIndex, setTapIndex] = useState(0);
  const [happy, setHappy] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  function assistant(text: string) {
    setBubble(text);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text }]);
  }
  function user(text: string) { setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text }]); }
  function mainActions() { setMode("idle"); setReplies(mainReplies); }
  function restart() {
    setMode("idle"); setDraft({}); setPendingPurchaseId(null); setBubble(welcomeMessage); setReplies(mainReplies);
    setMessages([{ id: crypto.randomUUID(), role: "assistant", text: welcomeMessage }]);
  }
  function askReason(nextDraft = draft) { setDraft(nextDraft); setMode("add-reason"); assistant("それが欲しい理由を教えてください。あとから見返したときに思い出しやすくなります。"); setReplies([{ label: "理由はあとで", action: "skip-reason" }]); }
  function askPrice(nextDraft = draft) { setDraft(nextDraft); setMode("add-price"); assistant("おおよその価格はいくらですか？数字だけでも大丈夫です。"); setReplies([{ label: "価格は未定", action: "skip-price" }]); }
  function askPriority(nextDraft = draft) { setDraft(nextDraft); setMode("add-priority"); assistant("最後に、今の優先度を選んでください。"); setReplies([{ label: "高め", action: "set-priority", value: "high" }, { label: "ふつう", action: "set-priority", value: "medium" }, { label: "いつか", action: "set-priority", value: "low" }]); }
  function confirmAdd(nextDraft: Partial<WishDraft>) {
    const priority = nextDraft.priority ?? "medium";
    const priorityLabel = { high: "高め", medium: "ふつう", low: "いつか" }[priority];
    setDraft({ name: nextDraft.name ?? "", reason: nextDraft.reason ?? "", price: nextDraft.price ?? 0, priority });
    setMode("confirm-add");
    assistant(`この内容でリストに追加しますか？\n\n名前：${nextDraft.name}\n理由：${nextDraft.reason || "未設定"}\n価格：${nextDraft.price ? `${Number(nextDraft.price).toLocaleString("ja-JP")}円` : "価格未設定"}\n優先度：${priorityLabel}`);
    setReplies([{ label: "この内容で追加", action: "confirm-add", confirm: true }, { label: "やり直す", action: "restart-add" }, { label: "キャンセル", action: "cancel" }]);
  }
  function purchaseChoices() {
    const active = wishes.filter((wish) => wish.status === "active");
    if (!active.length) { assistant("いま「欲しい」状態のものはありません。新しく追加しますか？"); return mainActions(); }
    setMode("choose-purchase"); assistant("どれが買えましたか？"); setReplies(active.slice(0, 8).map((wish) => ({ label: wish.name, action: "choose-purchase", value: wish.id })));
  }
  function purchaseConfirmation(id: string) {
    const wish = wishes.find((item) => item.id === id);
    if (!wish) return purchaseChoices();
    setPendingPurchaseId(id); setMode("confirm-purchase"); assistant(`「${wish.name}」を「買えた」に変更しますか？`);
    setReplies([{ label: "買えたに変更", action: "confirm-purchase", confirm: true }, { label: "選び直す", action: "start-purchase" }, { label: "キャンセル", action: "cancel" }]);
  }
  function action(actionName: string, value = "") {
    if (actionName === "start-add") { user("欲しいものを追加したい"); setDraft({}); setMode("add-name"); assistant("何が欲しいですか？"); setReplies([]); }
    else if (actionName === "skip-reason") { user("理由はあとで"); askPrice({ ...draft, reason: "" }); }
    else if (actionName === "skip-price") { user("価格は未定"); askPriority({ ...draft, price: 0 }); }
    else if (actionName === "set-priority") { const priority = value as WishPriority; user({ high: "優先度は高め", medium: "優先度はふつう", low: "いつか欲しい" }[priority]); confirmAdd({ ...draft, priority }); }
    else if (actionName === "confirm-add") { const complete = draft as WishDraft; onAdd(complete); user("この内容で追加"); assistant(`「${complete.name}」をリストに追加しました。`); setDraft({}); mainActions(); }
    else if (actionName === "restart-add") { user("やり直す"); setDraft({}); setMode("add-name"); assistant("わかりました。何が欲しいですか？"); setReplies([]); }
    else if (actionName === "start-purchase") { user("買えたものを報告したい"); purchaseChoices(); }
    else if (actionName === "choose-purchase") { const wish = wishes.find((item) => item.id === value); if (wish) user(wish.name); purchaseConfirmation(value); }
    else if (actionName === "confirm-purchase" && pendingPurchaseId) { const wish = wishes.find((item) => item.id === pendingPurchaseId); if (!wish) return purchaseChoices(); user("買えたに変更"); onPurchase(wish.id); assistant(`「${wish.name}」を買えたものとして記録しました。おめでとうございます！`); setPendingPurchaseId(null); mainActions(); }
    else if (actionName === "view-list") { onCloseChat(); onViewList(); }
    else if (actionName === "cancel") { user("キャンセル"); assistant("変更せずに戻しました。ほかにできることはありますか？"); setDraft({}); setPendingPurchaseId(null); mainActions(); }
  }
  function text(raw: string) {
    const value = raw.trim(); if (!value) return;
    user(value); setReplies([]);
    if (mode === "add-name") { const name = extractWishName(value); if (!name) return assistant("追加したいものの名前を教えてください。"); return askReason({ ...draft, name }); }
    if (mode === "add-reason") return askPrice({ ...draft, reason: value });
    if (mode === "add-price") { const digits = value.replace(/[^0-9]/g, ""); if (!digits) { assistant("数字で入力するか、「価格は未定」を選んでください。"); return setReplies([{ label: "価格は未定", action: "skip-price" }]); } return askPriority({ ...draft, price: Number(digits) }); }
    if (mode === "add-priority") { const priority = parsePriority(value); if (!priority) { assistant("「高め」「ふつう」「いつか」のどれかで教えてください。"); return setReplies([{ label: "高め", action: "set-priority", value: "high" }, { label: "ふつう", action: "set-priority", value: "medium" }, { label: "いつか", action: "set-priority", value: "low" }]); } return confirmAdd({ ...draft, priority }); }
    if (mode === "choose-purchase") { const match = wishes.find((wish) => wish.status === "active" && (wish.name.includes(value) || value.includes(wish.name))); return match ? purchaseConfirmation(match.id) : purchaseChoices(); }
    if (mode === "confirm-add") { if (/^(はい|追加|確定|ok|お願い)/i.test(value)) return action("confirm-add"); if (/キャンセル|やめ/.test(value)) return action("cancel"); assistant("内容を確認して、下のボタンから選んでください。"); return setReplies([{ label: "この内容で追加", action: "confirm-add", confirm: true }, { label: "やり直す", action: "restart-add" }, { label: "キャンセル", action: "cancel" }]); }
    if (mode === "confirm-purchase") { if (/^(はい|変更|確定|ok)/i.test(value)) return action("confirm-purchase"); if (/キャンセル|やめ/.test(value)) return action("cancel"); assistant("対象を確認して、下のボタンから選んでください。"); return; }
    if (/買えた|購入した|買った/.test(value)) return purchaseChoices();
    if (/リスト|一覧/.test(value)) { assistant("欲しいものの一覧を開きます。"); return window.setTimeout(onViewList, 300); }
    if (/欲しい|ほしい|買いたい|追加/.test(value)) { const name = extractWishName(value); if (name && !/^(もの|物)$/.test(name)) return askReason({ name }); setMode("add-name"); assistant("何が欲しいですか？"); return; }
    assistant("欲しいものの追加、買えたものの報告、リストの確認をお手伝いできます。"); mainActions();
  }
  function characterTap() {
    const flowHint: Partial<Record<ChatMode, string>> = { "add-name": "追加したいものの名前を教えてください。", "add-reason": "欲しい理由を教えてください。", "add-price": "価格を数字で入力するか、「価格は未定」を選べます。", "add-priority": "今の気持ちに近い優先度を選んでください。", "confirm-add": "追加する前に、吹き出しの内容を確認してください。", "choose-purchase": "買えたものを候補から選んでください。", "confirm-purchase": "変更する対象が合っているか確認してください。" };
    if (flowHint[mode]) return setBubble(flowHint[mode]!);
    const lines = ["今日は、どんなものが気になっていますか？", "思いついたものは、名前だけでも覚えておけますよ。", "買えたものがあったら、一緒に記録しましょう。", "迷っているものも、いったん保留として置いておけます。"]; setBubble(lines[tapIndex % lines.length]); setTapIndex((index) => index + 1); setHappy((value) => !value);
  }
  function submitHome(event: FormEvent) { event.preventDefault(); text(homeInput); setHomeInput(""); }
  function submitChat(event: FormEvent) { event.preventDefault(); text(chatInput); setChatInput(""); }
  const replyButtons = (className: string) => <div className={className}>{replies.map((reply) => <button key={`${reply.action}-${reply.value ?? reply.label}`} className={`chat-chip${reply.confirm ? " confirm" : ""}`} type="button" onClick={() => action(reply.action, reply.value)}>{reply.label}</button>)}</div>;

  const chatRoom = <section className="chat-layer portal-layer" aria-label="アシスターとのチャットルーム" hidden={!chatOpen}><header className="chat-header"><button className="chat-close" type="button" aria-label="チャットを閉じる" onClick={onCloseChat}>←</button><div className="chat-title"><span className="chat-avatar">A</span><div><strong>アシスター</strong><small>このセッションの会話を表示しています</small></div></div><button className="chat-restart" type="button" onClick={restart}>新しい会話</button></header><div className="chat-messages" ref={messagesRef}>{messages.map((message) => <div className={`chat-message ${message.role}`} key={message.id}>{message.text}</div>)}</div>{replyButtons("chat-quick-replies")}<form className="chat-composer" onSubmit={submitChat}><label className="sr-only" htmlFor="chat-input">メッセージ</label><input id="chat-input" value={chatInput} onChange={(event) => setChatInput(event.target.value)} maxLength={100} placeholder="メッセージを入力" /><button aria-label="送信">↑</button></form></section>;
  return <>{homeVisible && <article className="assistant-card"><div className="ambient ambient-one" /><div className="ambient ambient-two" /><Character happy={happy} onClick={characterTap} /><div className="home-speech-bubble" role="status" aria-live="polite">{bubble}</div>{replyButtons("home-quick-replies")}<form className="home-composer" onSubmit={submitHome}><label className="sr-only" htmlFor="home-chat-input">アシスターへのメッセージ</label><input id="home-chat-input" value={homeInput} onChange={(event) => setHomeInput(event.target.value)} maxLength={100} placeholder="アシスターに話しかける" /><button aria-label="送信">↑</button></form></article>}{createPortal(chatRoom, document.body)}</>;
}

function WishDialog({ onClose, onSave }: { onClose: () => void; onSave: (draft: WishDraft) => void }) {
  const [name, setName] = useState(""); const [reason, setReason] = useState(""); const [price, setPrice] = useState(""); const [priority, setPriority] = useState<WishPriority>("medium");
  function submit(event: FormEvent) { event.preventDefault(); onSave({ name: name.trim(), reason: reason.trim(), price: Number(price.replace(/[^0-9]/g, "")) || 0, priority }); onClose(); }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="wish-dialog" role="dialog" aria-modal="true" aria-labelledby="wish-dialog-title"><form onSubmit={submit}><div className="dialog-heading"><div><p className="eyebrow">欲しいもの</p><h2 id="wish-dialog-title">新しく追加する</h2></div><button className="close-button" type="button" aria-label="閉じる" onClick={onClose}>×</button></div><label>名前<span>必須</span><input required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="例：読みやすい電子書籍リーダー" autoFocus /></label><label>欲しい理由<textarea rows={3} maxLength={160} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="これがあると、どんな時間が増えそうですか？" /></label><div className="form-row"><label>おおよその価格<input inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="例：30000" /></label><label>優先度<select value={priority} onChange={(event) => setPriority(event.target.value as WishPriority)}><option value="high">高め</option><option value="medium">ふつう</option><option value="low">いつか</option></select></label></div><div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>キャンセル</button><button className="primary-button">リストに追加</button></div></form></section></div>;
}

function WishList({ wishes, onAddOpen, onStatus, onDelete }: { wishes: Wish[]; onAddOpen: () => void; onStatus: (id: string, status: WishStatus) => void; onDelete: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>("all"); const [page, setPage] = useState(0); const touchX = useRef(0); const stats = calculateWishStats(wishes);
  const filtered = wishes.filter((wish) => filter === "all" || wish.status === filter); const totalPages = Math.max(1, Math.ceil(filtered.length / 2)); const safePage = Math.min(page, totalPages - 1); const visible = filtered.slice(safePage * 2, safePage * 2 + 2);
  function changeFilter(next: Filter) { setFilter(next); setPage(0); }
  return <section className="view is-visible" data-page="wishes"><div className="page-heading list-heading"><div><p className="eyebrow">欲しいもの</p><h1>いつかを、見える形に</h1></div><button className="primary-button compact-button" type="button" onClick={onAddOpen}>＋ 追加</button></div><div className="stats-grid"><article className="stat-card"><span>欲しい</span><strong>{stats.active}</strong><small>個</small></article><article className="stat-card"><span>買えた</span><strong>{stats.purchased}</strong><small>個</small></article><article className="stat-card accent-stat"><span>実現率</span><strong>{stats.rate}</strong><small>%</small></article></div><div className="filter-buttons" role="group" aria-label="欲しいものの絞り込み">{(["all", "active", "purchased", "hold"] as Filter[]).map((value) => <button className={`filter-button${filter === value ? " is-active" : ""}`} key={value} type="button" onClick={() => changeFilter(value)}>{{ all: "すべて", active: "欲しい", purchased: "買えた", hold: "保留", retired: "手放した" }[value]}</button>)}</div>{filtered.length ? <div className="wish-list" onTouchStart={(event) => { touchX.current = event.changedTouches[0].clientX; }} onTouchEnd={(event) => { const direction = getSwipeDirection(touchX.current, event.changedTouches[0].clientX); if (direction === "next") setPage((value) => Math.min(totalPages - 1, value + 1)); if (direction === "previous") setPage((value) => Math.max(0, value - 1)); }}>{visible.map((wish) => <article className="wish-item" data-status={wish.status} key={wish.id}><div className="wish-visual" aria-hidden="true">{wish.status === "purchased" ? "✓" : wish.status === "hold" ? "…" : "◇"}</div><div className="wish-main"><h2>{wish.name}</h2><div className="wish-meta"><span>{wish.price ? `${wish.price.toLocaleString("ja-JP")}円` : "価格未設定"}</span><span className="priority">{{ high: "優先度 高め", medium: "優先度 ふつう", low: "いつか" }[wish.priority]}</span>{wish.reason && <span className="wish-reason">{wish.reason}</span>}</div></div><div className="wish-actions">{wish.status === "active" && <button className="quick-purchase" type="button" onClick={() => onStatus(wish.id, "purchased")}>✓ 買えた</button>}<label className="sr-only" htmlFor={`status-${wish.id}`}>{wish.name}の状態</label><select className="status-select" id={`status-${wish.id}`} value={wish.status} onChange={(event) => onStatus(wish.id, event.target.value as WishStatus)}><option value="active">欲しい</option><option value="purchased">買えた</option><option value="hold">保留</option><option value="retired">手放した</option></select><button className="delete-button" type="button" onClick={() => onDelete(wish.id)}>削除</button></div></article>)}</div> : <div className="empty-state"><span>◇</span><h2>まだ登録されていません</h2><p>気になっているものを、ひとつ置いてみましょう。</p><button className="primary-button" type="button" onClick={onAddOpen}>最初のひとつを追加</button></div>} {filtered.length > 0 && <div className="pagination"><button disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>←</button><span>{safePage + 1} / {totalPages}</span><button disabled={safePage >= totalPages - 1} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}>→</button></div>}</section>;
}

function AuthenticatedApp({ user, onSignedOut }: { user: User; onSignedOut: () => void }) {
  const queryClient = useQueryClient(); const key = ["wishes", user.id];
  const query = useQuery({ queryKey: key, queryFn: fetchWishes });
  const mutation = useMutation({ mutationFn: saveWishes, onError: () => queryClient.invalidateQueries({ queryKey: key }) });
  const wishes = query.data ?? [];
  const [view, setView] = useState<View>("home"); const [chatOpen, setChatOpen] = useState(false); const [menuOpen, setMenuOpen] = useState(false); const [wishDialog, setWishDialog] = useState(false); const [toast, setToast] = useState("");
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2600); return () => window.clearTimeout(timer); }, [toast]);
  function commit(next: Wish[], message: string) { queryClient.setQueryData(key, next); mutation.mutate(next, { onSuccess: (saved) => { queryClient.setQueryData(key, saved); setToast(message); }, onError: (error) => setToast(`保存できませんでした：${errorMessage(error)}`) }); }
  function add(draft: WishDraft) { commit([createWish(draft), ...wishes], "欲しいものに追加しました"); }
  function status(id: string, nextStatus: WishStatus) { const target = wishes.find((wish) => wish.id === id); commit(wishes.map((wish) => wish.id === id ? { ...wish, status: nextStatus } : wish), nextStatus === "purchased" && target?.status !== "purchased" ? `${target?.name}、実現おめでとうございます！` : "状態を更新しました"); }
  function remove(id: string) { const target = wishes.find((wish) => wish.id === id); if (target && window.confirm(`「${target.name}」を削除しますか？`)) commit(wishes.filter((wish) => wish.id !== id), "削除しました"); }
  function clearAll() { if (wishes.length && window.confirm("すべての欲しいものを削除しますか？この操作は元に戻せません。")) { commit([], "すべて削除しました"); setMenuOpen(false); } }
  async function signOut() { await logout(); queryClient.removeQueries({ queryKey: key }); onSignedOut(); }
  if (query.isLoading) return <SplashScreen />;
  if (query.isError) return <main className="auth-shell"><section className="auth-card compact-auth"><span className="brand-mark">A</span><h1>データを読み込めません</h1><p>{errorMessage(query.error)}</p><button className="primary-button auth-submit" onClick={() => query.refetch()}>もう一度試す</button><button className="text-button" onClick={signOut}>ログアウト</button></section></main>;
  const today = new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(new Date());
  return <div className="app-shell"><main className="main-content"><header className="app-header"><button className="brand brand-button" type="button" onClick={() => setView("home")}><span className="brand-mark">A</span><span>アシスター</span><small>v1</small></button><div className="menu-wrap"><button className="menu-button" type="button" aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><span /><span /><span /></button>{menuOpen && <div className="menu-popover"><p className="eyebrow">アカウント</p><div className="menu-status"><i /><span>{user.name || "ログイン中"}<br /><small>{user.email}</small></span></div><div className="sync-status" data-state={mutation.isError ? "error" : mutation.isPending ? "saving" : "saved"}>{mutation.isError ? "保存エラー" : mutation.isPending ? "保存中…" : "クラウドに保存済み"}</div><button className="menu-reset" type="button" onClick={clearAll}>欲しいものをすべて削除</button><button className="menu-logout" type="button" onClick={signOut}>ログアウト</button></div>}</div></header><section className={`view${view === "home" ? " is-visible" : ""}`} data-page="home"><div className="page-heading home-heading"><p className="eyebrow">{today}</p><h1>おかえりなさい</h1></div><Conversation homeVisible={view === "home"} wishes={wishes} onAdd={add} onPurchase={(id) => status(id, "purchased")} onViewList={() => setView("wishes")} chatOpen={chatOpen} onCloseChat={() => setChatOpen(false)} /></section>{view === "wishes" && <WishList wishes={wishes} onAddOpen={() => setWishDialog(true)} onStatus={status} onDelete={remove} />}</main><nav className="bottom-nav" aria-label="画面メニュー"><button className={`bottom-item${view === "wishes" ? " is-active" : ""}`} type="button" onClick={() => setView("wishes")}><span>◇</span>欲しいもの</button><button className={`bottom-item home-item${view === "home" ? " is-active" : ""}`} type="button" onClick={() => setView("home")}><span>A</span>ホーム</button><button className="bottom-item" type="button" onClick={() => setChatOpen(true)}><span>●</span>チャット</button></nav>{wishDialog && <WishDialog onClose={() => setWishDialog(false)} onSave={add} />}<div className={`toast${toast ? " is-visible" : ""}`} role="status">{toast}</div></div>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true); const [notice, setNotice] = useState(""); const [recoveryUser, setRecoveryUser] = useState<User | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const callback = await handleAuthCallback();
        if (!active) return;
        if (callback?.type === "recovery" && callback.user) { setRecoveryUser(callback.user); setUser(callback.user); }
        else if (callback?.user) { setUser(callback.user); setNotice("メール確認が完了しました。"); }
        else setUser(await getUser());
      } catch (error) { if (active) setNotice(errorMessage(error)); }
      finally { if (active) setLoading(false); }
    })();
    const unsubscribe = onAuthChange((_event, currentUser) => { if (active) setUser(currentUser); });
    return () => { active = false; unsubscribe(); };
  }, []);
  if (loading) return <SplashScreen />;
  if (recoveryUser) return <RecoveryScreen user={recoveryUser} onComplete={(currentUser) => { setRecoveryUser(null); setUser(currentUser); }} />;
  if (!user) return <AuthScreen notice={notice} onAuthenticated={setUser} />;
  return <AuthenticatedApp user={user} onSignedOut={() => setUser(null)} />;
}
