export default function ConfidentialitePage() {
  return (
    <article className="legal-prose">
      <h1>Politique de confidentialité</h1>
      <p className="lead">
        La présente politique de confidentialité décrit comment Datavocat SAS
        collecte, utilise et protège vos données personnelles conformément au
        Règlement Général sur la Protection des Données (RGPD) et à la loi
        Informatique et Libertés.
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement des données est :<br />
        <strong>{process.env.NEXT_PUBLIC_LEGAL_COMPANY || "Datavocat SAS"}</strong><br />
        {process.env.NEXT_PUBLIC_LEGAL_ADDRESS && (
          <>Siège social : {process.env.NEXT_PUBLIC_LEGAL_ADDRESS}<br /></>
        )}
        Contact : {process.env.NEXT_PUBLIC_LEGAL_DPO_EMAIL || "contact@datavocat.fr"}
      </p>

      <h2>2. Données collectées</h2>
      <h3>2.1 Données d&apos;inscription</h3>
      <ul>
        <li>Nom et prénom</li>
        <li>Adresse email professionnelle</li>
        <li>Nom du cabinet</li>
        <li>Mot de passe (chiffré)</li>
      </ul>

      <h3>2.2 Données d&apos;utilisation</h3>
      <ul>
        <li>Demandes d&apos;analyse (requêtes textuelles)</li>
        <li>Résultats d&apos;analyse générés</li>
        <li>Historique de navigation dans l&apos;application</li>
        <li>Préférences de l&apos;interface (thème, notifications)</li>
      </ul>

      <h3>2.3 Absence de fichier client</h3>
      <p>
        Datavocat ne propose aucune fonction de gestion de clientèle et ne
        constitue aucun fichier nominatif de clients finaux : ni nom, ni
        coordonnées, ni dossier. Les seules informations relatives à une
        affaire sont celles que l&apos;Utilisateur rédige librement dans sa
        demande d&apos;analyse, sous sa seule responsabilité et dans le respect
        du secret professionnel auquel il est tenu. Il lui appartient de ne pas
        y faire figurer d&apos;éléments directement identifiants.
      </p>

      <h3>2.4 Corpus de jurisprudence et contrôle qualité</h3>
      <p>
        Pour chaque analyse sont conservés : les décisions de justice publiques
        transmises au modèle (elles proviennent de Judilibre et de Légifrance et
        ne contiennent aucune donnée personnelle de l&apos;Utilisateur), ainsi
        que les indicateurs du contrôle automatique des sources. Ces éléments
        permettent de vérifier a posteriori qu&apos;une analyse s&apos;appuie
        bien sur des décisions réelles.
      </p>

      <h3>2.5 Mesure de consommation</h3>
      <p>
        Chaque appel aux modèles d&apos;analyse est enregistré (identifiant et
        adresse email de l&apos;Utilisateur, modèle appelé, volumétrie, coût
        estimé, horodatage) à des fins de facturation, de supervision technique
        et de limitation des abus.
      </p>

      <h3>2.6 Données techniques</h3>
      <ul>
        <li>Adresse IP</li>
        <li>Type de navigateur et système d&apos;exploitation</li>
        <li>Pages consultées et horodatage</li>
      </ul>

      <h2>3. Finalités du traitement</h2>
      <table>
        <thead>
          <tr>
            <th>Finalité</th>
            <th>Base légale</th>
            <th>Durée de conservation</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Fourniture du service d&apos;analyse</td>
            <td>Exécution du contrat</td>
            <td>Durée du compte + 1 an</td>
          </tr>
          <tr>
            <td>Gestion du compte utilisateur</td>
            <td>Exécution du contrat</td>
            <td>Durée du compte + 1 an</td>
          </tr>
          <tr>
            <td>Amélioration du service</td>
            <td>Intérêt légitime</td>
            <td>26 mois (anonymisées)</td>
          </tr>
          <tr>
            <td>Communication commerciale</td>
            <td>Consentement</td>
            <td>Jusqu&apos;au retrait du consentement</td>
          </tr>
          <tr>
            <td>Obligations légales</td>
            <td>Obligation légale</td>
            <td>Durée légale applicable</td>
          </tr>
        </tbody>
      </table>

      <h2>4. Destinataires des données</h2>
      <p>Vos données sont accessibles uniquement aux :</p>
      <ul>
        <li>Membres autorisés de l&apos;équipe Datavocat</li>
        <li>
          Sous-traitants techniques :
          <ul>
            <li><strong>Supabase</strong> — hébergement base de données (UE)</li>
            <li><strong>Vercel</strong> — hébergement application</li>
            <li><strong>Anthropic</strong> — traitement IA (API Claude)</li>
          </ul>
        </li>
      </ul>
      <p>
        Aucune donnée n&apos;est vendue, louée ou transmise à des tiers à des
        fins commerciales.
      </p>

      <h2>5. Transferts hors UE</h2>
      <p>
        Certains sous-traitants (Vercel, Anthropic) sont situés aux États-Unis.
        Les transferts sont encadrés par les clauses contractuelles types de la
        Commission européenne et le Data Privacy Framework.
      </p>

      <h2>6. Sécurité des données</h2>
      <p>Datavocat met en œuvre les mesures de sécurité suivantes :</p>
      <ul>
        <li>Chiffrement des données en transit (TLS 1.3) et au repos (AES-256)</li>
        <li>Authentification sécurisée avec hachage des mots de passe</li>
        <li>
          Row Level Security (RLS) au niveau de la base de données — chaque
          analyse n&apos;est accessible qu&apos;à son auteur
        </li>
        <li>
          En-têtes de sécurité navigateur (CSP, HSTS) et limitation du débit par
          utilisateur
        </li>
        <li>Sauvegardes automatiques quotidiennes assurées par l&apos;hébergeur</li>
        <li>Accès administrateur restreint à une liste nominative</li>
      </ul>

      <h2>7. Vos droits</h2>
      <p>
        Conformément au RGPD, vous disposez des droits suivants :
      </p>
      <ul>
        <li><strong>Droit d&apos;accès</strong> — obtenir une copie de vos données</li>
        <li><strong>Droit de rectification</strong> — corriger vos données inexactes</li>
        <li><strong>Droit à l&apos;effacement</strong> — demander la suppression de vos données</li>
        <li><strong>Droit à la portabilité</strong> — recevoir vos données dans un format structuré</li>
        <li><strong>Droit d&apos;opposition</strong> — vous opposer au traitement de vos données</li>
        <li><strong>Droit à la limitation</strong> — restreindre le traitement</li>
      </ul>
      <p>
        Pour exercer ces droits, contactez-nous à :{" "}
        <strong>
          {process.env.NEXT_PUBLIC_LEGAL_DPO_EMAIL || "contact@datavocat.fr"}
        </strong>
      </p>
      <p>
        Nous nous engageons à répondre dans un délai de 30 jours. En cas de
        difficulté, vous pouvez introduire une réclamation auprès de la{" "}
        <strong>CNIL</strong> (Commission Nationale de l&apos;Informatique et des Libertés).
      </p>

      <h2>8. Cookies</h2>
      <h3>8.1 Cookies utilisés</h3>
      <table>
        <thead>
          <tr>
            <th>Cookie</th>
            <th>Finalité</th>
            <th>Durée</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>sb-*-auth-token</td>
            <td>Authentification Supabase</td>
            <td>Session</td>
            <td>Strictement nécessaire</td>
          </tr>
          <tr>
            <td>datavocat_theme</td>
            <td>Préférence thème clair/sombre</td>
            <td>1 an</td>
            <td>Fonctionnel</td>
          </tr>
          <tr>
            <td>datavocat_preferences</td>
            <td>Préférences utilisateur</td>
            <td>1 an</td>
            <td>Fonctionnel</td>
          </tr>
        </tbody>
      </table>
      <h3>8.2 Cookies tiers</h3>
      <p>
        Datavocat n&apos;utilise aucun cookie publicitaire, de traçage ou
        d&apos;analyse tiers (pas de Google Analytics, pas de pixels de suivi).
      </p>

      <h2>9. Traitement par intelligence artificielle</h2>
      <p>
        Les demandes d&apos;analyse sont transmises à l&apos;API Claude (Anthropic)
        pour générer les résultats. Les données sont :
      </p>
      <ul>
        <li>Transmises de manière chiffrée</li>
        <li>Non utilisées pour entraîner les modèles d&apos;IA (API commerciale)</li>
        <li>
          Conservées par Anthropic pendant une durée limitée, conformément aux
          conditions d&apos;utilisation de son API commerciale, à des fins de
          sécurité et de prévention des abus
        </li>
      </ul>
      <p>
        Il appartient à l&apos;Utilisateur, tenu au secret professionnel, de ne
        pas faire figurer dans ses demandes d&apos;éléments directement
        identifiants relatifs à ses clients.
      </p>

      <h2>10. Modification de la politique</h2>
      <p>
        Datavocat se réserve le droit de modifier la présente politique. Les
        utilisateurs seront informés de toute modification substantielle par
        email ou notification dans l&apos;application.
      </p>

      <hr />
      <p className="text-muted-foreground">
        Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
      </p>
    </article>
  );
}
