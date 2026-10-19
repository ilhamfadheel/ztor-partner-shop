import Link from "next/link";
import { StateMessage } from "@/components/StateMessage";
import { dict } from "@/lib/i18n";
import { resolveLang } from "@/lib/lang";

export default async function NotFound() {
  const t = dict(await resolveLang());
  return (
    <StateMessage heading="h1" icon="search" title={t.notFound.title} actions={<Link href="/" className="btn btn-primary">{t.common.backToShop}</Link>}>
      <p>{t.notFound.body}</p>
    </StateMessage>
  );
}
