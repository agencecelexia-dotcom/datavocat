export default function MentionsLegalesPage() {
  return (
    <article className="legal-prose">
      <h1>Mentions légales</h1>
      <p className="lead">
        Conformément aux dispositions des articles 6-III et 19 de la loi
        n°2004-575 du 21 juin 2004 pour la Confiance dans l&apos;économie
        numérique (LCEN), les présentes mentions légales sont portées à la
        connaissance des utilisateurs du site Datavocat.
      </p>

      {/*
        À COMPLÉTER AVANT MISE EN PRODUCTION.
        L'article 6-III de la LCEN impose la dénomination sociale, l'adresse du
        siège, le numéro RCS et le directeur de la publication. Ces champs sont
        alimentés par variables d'environnement pour ne pas figer d'information
        d'entreprise dans le code — renseigner NEXT_PUBLIC_LEGAL_* au déploiement.
      */}
      <h2>1. Éditeur du site</h2>
      <p>
        Le site Datavocat est édité par :<br />
        <strong>{process.env.NEXT_PUBLIC_LEGAL_COMPANY || "Datavocat SAS"}</strong><br />
        {process.env.NEXT_PUBLIC_LEGAL_CAPITAL && (
          <>Société par actions simplifiée au capital de {process.env.NEXT_PUBLIC_LEGAL_CAPITAL} euros<br /></>
        )}
        {process.env.NEXT_PUBLIC_LEGAL_RCS && (
          <>Immatriculée au RCS sous le numéro {process.env.NEXT_PUBLIC_LEGAL_RCS}<br /></>
        )}
        {process.env.NEXT_PUBLIC_LEGAL_ADDRESS && (
          <>Siège social : {process.env.NEXT_PUBLIC_LEGAL_ADDRESS}<br /></>
        )}
        {process.env.NEXT_PUBLIC_LEGAL_VAT && (
          <>Numéro de TVA intracommunautaire : {process.env.NEXT_PUBLIC_LEGAL_VAT}<br /></>
        )}
        Email : contact@datavocat.fr
      </p>

      <h2>2. Directeur de la publication</h2>
      <p>
        {process.env.NEXT_PUBLIC_LEGAL_PUBLISHER
          ? `Le directeur de la publication est ${process.env.NEXT_PUBLIC_LEGAL_PUBLISHER}.`
          : "Le directeur de la publication est le représentant légal de la société éditrice."}
      </p>

      <h2>3. Hébergeur</h2>
      <p>
        Le site est hébergé par :<br />
        <strong>Vercel Inc.</strong><br />
        440 N Barranca Ave #4133, Covina, CA 91723, États-Unis<br />
        Site web : vercel.com
      </p>
      <p>
        Les données sont stockées par :<br />
        <strong>Supabase Inc.</strong><br />
        970 Toa Payoh North #07-04, Singapour 318992<br />
        Région de données : Europe (eu-west)
      </p>

      <h2>4. Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble des éléments constituant le site Datavocat (textes,
        graphismes, logiciels, photographies, images, vidéos, sons, plans,
        logos, marques, etc.) ainsi que le site lui-même sont protégés par les
        lois en vigueur en France et par les textes internationaux relatifs à
        la propriété intellectuelle.
      </p>
      <p>
        Toute reproduction, représentation, modification, publication,
        adaptation de tout ou partie des éléments du site, quel que soit le
        moyen ou le procédé utilisé, est interdite, sauf autorisation écrite
        préalable de Datavocat SAS.
      </p>

      <h2>5. Données personnelles</h2>
      <p>
        Les informations collectées sur le site font l&apos;objet d&apos;un
        traitement informatique destiné à fournir les services proposés par
        Datavocat. Conformément au Règlement Général sur la Protection des
        Données (RGPD) et à la loi Informatique et Libertés, vous disposez
        d&apos;un droit d&apos;accès, de rectification, de suppression et
        d&apos;opposition sur vos données personnelles.
      </p>
      <p>
        Pour exercer ces droits, contactez-nous à : dpo@datavocat.fr
      </p>
      <p>
        Pour en savoir plus, consultez notre{" "}
        <a href="/confidentialite">politique de confidentialité</a>.
      </p>

      <h2>6. Cookies</h2>
      <p>
        Le site Datavocat utilise des cookies strictement nécessaires au
        fonctionnement du service (authentification, préférences utilisateur).
        Aucun cookie publicitaire ou de traçage tiers n&apos;est utilisé.
      </p>

      <h2>7. Limitation de responsabilité</h2>
      <p>
        Les analyses et données fournies par Datavocat sont générées à l&apos;aide
        d&apos;intelligence artificielle et de données publiques. Elles sont
        fournies à titre indicatif et ne constituent en aucun cas un avis
        juridique. L&apos;utilisateur reste seul responsable de l&apos;usage
        qu&apos;il fait des informations fournies.
      </p>
      <p>
        Datavocat SAS ne saurait être tenue responsable des dommages directs
        ou indirects résultant de l&apos;utilisation du site ou de
        l&apos;impossibilité d&apos;y accéder.
      </p>

      <h2>8. Droit applicable</h2>
      <p>
        Les présentes mentions légales sont soumises au droit français. En cas
        de litige, les tribunaux de Paris seront seuls compétents.
      </p>

      <hr />
      <p className="text-muted-foreground">
        Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
      </p>
    </article>
  );
}
