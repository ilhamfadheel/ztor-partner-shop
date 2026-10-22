import { StateMessage } from "@/components/StateMessage";
import { dict } from "@/lib/i18n";
import { resolveLang } from "@/lib/lang";

export default async function NotFound() {
  const t = dict(await resolveLang());
  return (
    <StateMessage heading="h1" icon="search" title={t.notFound.title} actions={<a href="/shop" className="btn btn-primary">{t.common.backToShop}</a>}>
      <p>{t.notFound.body}</p>
    </StateMessage>
  );
}
