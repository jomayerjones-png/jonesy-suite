import pg from 'pg';
const { Client: PgClient } = pg;

const db = new PgClient({ connectionString: process.env.SUPABASE_DB_URL });
await db.connect();

const D = '2026-04-18';
const s = (id, name, company, email, value, industry, tranche, tier, temp, product, rationale, next) => ({
  id, name, company, email, phone: '', value, stage: 'Prospect',
  notes: `${product}. ${rationale} Next: ${next}`,
  lastContact: D, createdAt: D,
  tags: [industry, tranche, `Tier ${tier}`, temp],
  proposals: [], industry, outcome: 'active', lostReason: '',
  stageHistory: [{ stage: 'Prospect', date: D }],
});

const clients = [
  // T1 / Tech
  s('STAT-001','Jane Smith','Acme Corp','jane.smith@example.com',2500000,'Tech','T1','A','Hot','Multi (Newsletter + Podcast)','Existing engagement with newsletter inventory. Current budget and relationship in place.','Email intro within 2 weeks.'),
  s('STAT-002','Alex Johnson','Bright Labs','alex.johnson@example.com',0,'Tech','T1','A','Warm','Multi (Newsletter + Power Lines + Event)','Strong alignment with industry coverage. Launch-window package opportunity.','Warm intro via internal contact; follow up at a live event.'),
  s('STAT-003','Morgan Lee','Titan Industries','morgan.lee@example.com',0,'Tech','T1','A','Warm','Multi','Narrative challenges in regulatory and market areas make readers exactly the audience they need.','Intro via policy lead or comms director.'),
  s('STAT-004','Chris Taylor','Apex Technologies','',0,'Tech','T1','A','Warm','Newsletter + Event','Company is a major industry story. Comms budget increasingly allocated to premium insider media.','Email; reference prior intro if needed.'),
  s('STAT-005','Jordan Rivera','FreshCart','jordan.rivera@example.com',0,'Tech','T1','B','Warm','Newsletter + Event','Senior comms role focused on shaping media presence. Strong audience alignment.','Warm email; suggest coffee meeting.'),
  s('STAT-006','Sam Parker','CreativeEdge','sam.parker@example.com',0,'Tech','T1','B','Warm','Multi','Company sits at the intersection of creative and tech industries. Dual marketing and comms role controls both budgets.','Email; offer themed content integration.'),
  s('STAT-007','Drew Mitchell','BlueBridge Corp','drew.mitchell@example.com',0,'Tech','T1','B','Warm','Newsletter (Presenting Sponsor)','Multi-year track record of advertising in premium executive newsletters.','Formal outreach with rate card.'),
  s('STAT-008','Avery Chen','Vertex Computing','avery.chen@example.com',0,'Tech','T1','B','Warm','Newsletter + Event','Significant brand budget owned globally. Executive audience overlap near-perfect with demographics.','Email; propose discovery call.'),
  s('STAT-009','TBD — Head of Brand/Comms','Nova AI','',0,'Tech','T1','A','Cold','Multi','Emerging brand still forming market surface. Offers targeted reach to the audience whose perception matters most.','LinkedIn outbound to comms/brand lead.'),
  s('STAT-010','TBD — Head of Marketing','SearchWave','',0,'Tech','T1','B','Cold','Newsletter + Podcast','Company is a frequent topic in industry coverage. Smaller team enables faster decisions.','LinkedIn via writer network.'),
  // T1 / Finance
  s('STAT-011','Robin Patel','GlobalPay','robin.patel@example.com',0,'Finance','T1','A','Warm','Multi','Global CMO and industry thought-leader. Premium exec reach and event stage opportunity.','Warm email; pitch podcast appearance as entry point.'),
  s('STAT-012','Casey Martin','Prestige Financial','casey.martin@example.com',0,'Finance','T1','A','Warm','Newsletter + Event','Senior comms role at premium brand. High-value audience maps to reader cohort.','Intro via internal contact; tiered package.'),
  s('STAT-013','Jamie Brooks','Cornerstone Investments','jamie.brooks@example.com',0,'Finance','T1','A','Warm','Newsletter','Spends heavily on corporate-reputation media. Head of Corporate Affairs controls budget directly.','Email; discovery call with team lead.'),
  s('STAT-014','Logan Torres','Summit Bank','logan.torres@example.com',0,'Finance','T1','A','Warm','Multi','Gatekeeper of company media narrative. Audience includes key journalists.','Formal intro through founder relationships.'),
  s('STAT-015','Taylor Kim','Pinnacle Asset Management','taylor.kim@example.com',0,'Finance','T1','A','Warm','Newsletter (Information Wars + Report)','Company in a long-running narrative challenge. Reaches decision-influencers at scale.','Email; frame around regulatory calendar.'),
  s('STAT-016','Marco Rossi','Alpine Insurance','',0,'Finance','T1','A','Hot','Multi (Newsletter + Event)','Prior partnership at scale with event tie-ins. Precedent for partnership-level deals.','Email via executive assistant.'),
  s('STAT-017','Dana Cruz','Sterling Securities','dana.cruz@example.com',0,'Finance','T1','B','Warm','Newsletter + Event','Head of Brand Marketing is budget owner for exec-audience brand plays. History of premium newsletter placements.','Email; partner with marketing contact for intro.'),
  s('STAT-018','Priya Gupta','Vanguard Bank','priya.gupta@example.com',0,'Finance','T1','B','Warm','Newsletter','Doubled down on premium publishers recently. Real discretionary brand budget.','Email.'),
  s('STAT-019','Riley Foster','Meridian Partners','riley.foster@example.com',0,'Finance','T1','B','Warm','Newsletter + Event','Partner-level comms head. History of flagship-newsletter sponsorships.','Warm email; propose exploratory call.'),
  s('STAT-020','Harper Quinn','Prestige Financial','harper.quinn@example.com',0,'Finance','T1','B','Warm','Newsletter (themed)','Foundation and sustainability programs represent separate budget from main brand. Funds premium purpose placements.','Pair with senior comms pitch to unlock dual budget.'),
  // T1 / Public Affairs
  s('STAT-021','Cameron West','Capitol Strategies','cameron.west@example.com',6000000,'Public Affairs','T1','A','Hot','Multi (agency-level deal)','Existing large agency-wide engagement flagged. Largest pattern in the contact book.','Urgent — reactivate; propose agency MSA.'),
  s('STAT-022','Blake Anderson','Capitol Strategies','blake.anderson@example.com',6000000,'Public Affairs','T1','A','Warm','Multi (agency-level deal)','Top of house at agency. Agency-wide deal needs CEO sign-off.','Reach out in parallel with Cameron West.'),
  s('STAT-023','Reese Hamilton','National Health Alliance','reese.hamilton@example.com',1000000,'Public Affairs','T1','A','Hot','Newsletter + Event','Large media spend at prior publisher. Consistent recurring public affairs budget.','Urgent — email with rate card within 1 week.'),
  s('STAT-024','Skyler Bennett','MegaMart','skyler.bennett@example.com',0,'Public Affairs','T1','A','Hot','Multi (tentpole partnership)','Multi-channel partnership flagged. Company buys partnerships, not placements.','Coordinate with VP Corp Affairs (tranche 2).'),
  s('STAT-025','Finley Clark','National Beverage Council','finley.clark@example.com',100000,'Public Affairs','T1','A','Hot','Newsletter','Estimated revenue flagged. Regulatory narrative makes spend urgent — launching multiple campaigns now.','Urgent — email this week tied to active campaigns.'),
  s('STAT-026','Ellis Morgan','Capitol Strategies','',460000,'Public Affairs','T1','A','Hot','Newsletter (vertical sponsorship)','Large branded content opportunity flagged during recent industry event.','Urgent — propose bespoke package.'),
  s('STAT-027','Hayden Phillips','Keystone Communications','hayden.phillips@example.com',0,'Public Affairs','T1','B','Warm','Multi (agency-level deal)','Marquee DC comms firm with multiple clients across health, energy, tech. Agency relationship unlocks portfolio rate card.','Warm email; propose portfolio conversation.'),
  s('STAT-028','Kendall Price','Granite Public Affairs','kendall.price@example.com',0,'Public Affairs','T1','B','Warm','Newsletter (client-by-client)','Multiple contacts in book. Bipartisan firm with solid client spend. Relationship multiplier.','Coffee/call — strong relationship multiplier.'),
  s('STAT-029','Quinn Novak','Industrial Trade Council','quinn.novak@example.com',0,'Public Affairs','T1','B','Warm','Newsletter + Event','Trade association CEO with recurring narrative-defence spend. Multiple contacts in book.','Email; offer event partnership.'),
  s('STAT-030','Rowan Grant','Sterling Advisory Group','',0,'Public Affairs','T1','B','Warm','Multi (agency-level deal)','Agency actively running major client accounts. Consulting business expanding. Multiple contacts in book.','Reference prior follow-up mentioned in notes.'),
  // T1 / Media
  s('STAT-031','Emery Collins','CableVision Corp','emery.collins@example.com',1000000,'Media','T1','A','Hot','Multi (tentpole — sports)','Large sports partnership flagged with major event tie-in. Active brief in progress.','Urgent — propose within 2 weeks.'),
  s('STAT-032','Sage Monroe','CableVision Corp','sage.monroe@example.com',0,'Media','T1','B','Warm','Newsletter','Double coverage at company — corporate comms is a separate budget from brand team.','Soft follow-up after brand conversation.'),
  s('STAT-033','TBD — Head of Partnerships','WritersHub','',0,'Media','T1','A','Cold','Cross-promo + sponsorship','Platform growth lever is premium-newsroom legitimacy. Strong category alignment.','LinkedIn via writer network.'),
  s('STAT-034','Rory Adams','MailPilot','',0,'Media','T1','A','Warm','Newsletter (continued)','Company has already advertised previously. Not cold — ad-history lead. Renewal/expansion.','Direct outreach — founder accessible on LinkedIn/Twitter.'),
  s('STAT-035','Lena Park','The Insider Report','',0,'Media','T1','A','Cold','Partnership / cross-promo','Referenced in sales materials — relationship exists. Adjacent insider-media brands.','Direct email from leadership; reference the mention.'),
  s('STAT-036','Noel Hart','Insider Weekly','',0,'Media','T1','A','Cold','Partnership / cross-promo','Referenced in sales materials. Competitive adjacency with overlap — joint events, content swaps. Strategic relationship.','Direct email; propose coffee.'),
  s('STAT-037','TBD — VP Awards Marketing','StreamMax','',0,'Media','T1','A','Cold','Multi (awards season + tentpoles)','Company spends heavily against awards voters and industry press. Reader base includes significant guild members.','LinkedIn to awards marketing leadership.'),
  s('STAT-038','TBD — Head of Partnerships','NewsFront','',0,'Media','T1','B','Cold','Partnership / cross-promo','Insider-newsletter peer. Same category logic as adjacent media brands. Commercial partnerships infrastructure worth mirroring.','LinkedIn; low-urgency.'),
  s('STAT-039','TBD — Head of Brand Marketing','Galaxy Studios','',0,'Media','T1','B','Cold','Multi (tentpole tie-ins)','Studio releases need executive and agency reach. Entertainment coverage is the ideal delivery vehicle.','Intro via any company contact in database.'),
  s('STAT-040','TBD — Head of Podcast Partnerships','SoundStream','',0,'Media','T1','B','Cold','Podcast (Power Lines)','Two doors: ads on podcast, and a distribution deal with platform for the podcast itself.','LinkedIn; parallel to podcast-network outreach.'),
  // T2 / Tech
  s('STAT-041','Dakota Reeves','BlueBridge Corp','dakota.reeves@example.com',0,'Tech','T2','A','Hot','Multi (Founding Partnership)','Founding Partnership for content series and sections flagged. Company invests in media partnerships, not just ads.','Urgent — email with partnership structure proposal.'),
  s('STAT-042','Shawn Nakamura','Titan Industries','shawn.nakamura@example.com',0,'Tech','T2','A','Warm','Newsletter + Event','Controls company policy-comms budget at the global level. Reach regulators through this role.','Email; offer DC event partnership.'),
  s('STAT-043','Nico Alvarez','CryptoBase','nico.alvarez@example.com',0,'Tech','T2','A','Warm','Newsletter (Information Wars + Masters of the Universe)','Regulatory narrative is a perpetual coverage topic. Multiple contacts in the book.','Email; coordinate with policy lead.'),
  s('STAT-044','Terri Lawson','PolicyNet','terri.lawson@example.com',0,'Tech','T2','A','Warm','Newsletter + Event','CEO-level policy trade group. CEO relationship unlocks a shared-funding package model.','Warm email; propose member-funded package.'),
  s('STAT-045','Micah Stewart','NetConnect','micah.stewart@example.com',0,'Tech','T2','B','Warm','Newsletter (themed)','Unusually broad remit spanning People, Policy, and Purpose areas. Budget across three lanes. Under-tapped premium advertiser.','Email via LinkedIn; C-suite outreach.'),
  s('STAT-046','Val O\'Brien','ProLink','val.obrien@example.com',0,'Tech','T2','B','Warm','Newsletter','Company data platform gives comms team storytelling ammo that maps perfectly to industry beats.','Email; propose data-driven content partnership.'),
  s('STAT-047','Lee Hawkins','CloudSoft','lee.hawkins@example.com',0,'Tech','T2','B','Warm','Newsletter + Event','GM of Global Media — a media-buyer title. Multi-property presence across platform.','Email; highest odds of fast response among contacts.'),
  s('STAT-048','Paige Thornton','Tech Trade Association','paige.thornton@example.com',0,'Tech','T2','B','Warm','Newsletter + CES-tied Event','Association runs major annual trade show. Adjacent coverage is a natural annual sponsorship anchor.','Email in Q3 to line up annual event window.'),
  s('STAT-049','Sasha Brennan','Titan Industries','sasha.brennan@example.com',0,'Tech','T2','B','Warm','Newsletter (themed)','Sustainability team has a ring-fenced budget, separate from main brand and policy. Often overlooked by ad-sales teams.','Email; pitch alongside Climate Week.'),
  s('STAT-050','TBD — Head of Comms/Brand','Frontier AI','',0,'Tech','T2','A','Cold','Multi (Masters of the Universe)','Company featured in regular coverage. Lean team needs credibility-oriented placements.','LinkedIn direct to comms lead.'),
  // T2 / Finance
  s('STAT-051','Carey Sullivan','Sterling Securities','carey.sullivan@example.com',0,'Finance','T2','A','Warm','Multi','Title is Head of Global Media — they are the media buyer. Approved invite status in notes.','Email directly — strongest finance buyer profile in book.'),
  s('STAT-052','Marlowe Hayes','Metro Bank','marlowe.hayes@example.com',0,'Finance','T2','A','Warm','Newsletter (Information Wars)','Head of Global Gov Affairs — bank-wide policy budget sits here. Under narrative pressure from multiple regulatory fronts.','Formal email; senior-level tone.'),
  s('STAT-053','Devon Russo','Atlantic Financial','devon.russo@example.com',0,'Finance','T2','A','Warm','Newsletter + Event','Former government spokesperson; controls DC narrative budget. Company underspends on premium insider media.','Email; reference Washington presence.'),
  s('STAT-054','Jules Moreno','Metro Bank','jules.moreno@example.com',0,'Finance','T2','B','Warm','Newsletter','Reports through senior Gov Affairs lead. US-specific budget often sits separately — worth a parallel conversation.','Email after senior contact outreach.'),
  s('STAT-055','Frankie Dunn','Sterling Securities','frankie.dunn@example.com',0,'Finance','T2','B','Warm','Newsletter + Event','Content-marketing-adjacent title. Natural partner for custom content collabs and sponsored series.','Email; coordinate with brand marketing contact.'),
  s('STAT-056','Tatum Kemp','Vanguard Bank','tatum.kemp@example.com',0,'Finance','T2','B','Warm','Newsletter','Second CMO contact in book. Retail brand budget is a different pool from other contact.','Pair with other company outreach.'),
  s('STAT-057','Marley Fox','GlobalPay','marley.fox@example.com',0,'Finance','T2','B','Warm','Event (executive presence)','P&L owner for the Americas. Strategic relationship that unlocks commercial team.','Invite to a live event.'),
  s('STAT-058','Corey Watts','National Bank','corey.watts@example.com',0,'Finance','T2','B','Warm','Newsletter','Under-tapped institution in the sector. Public affairs comms controls the regulatory-reputation budget.','Email; pitch as unique positioning.'),
  s('STAT-059','Peyton Vega','Prestige Financial','peyton.vega@example.com',0,'Finance','T2','B','Warm','Newsletter','Second contact at company. Triangulate coverage across multiple contacts.','Email; coordinate with primary pitch.'),
  s('STAT-060','TBD — Chief Brand Officer/CMO','Universal Payments','',0,'Finance','T2','A','Cold','Multi','Essential counterweight in pipeline. Company has grown aggressively in exec-audience channels.','LinkedIn to Brand Officer; parallel outreach.'),
  // T2 / Public Affairs
  s('STAT-061','Addison Cole','Capitol Strategies','addison.cole@example.com',6000000,'Public Affairs','T2','A','Hot','Multi (agency MSA)','Third point of contact on large agency engagement. DC Leadership Team = decision-maker on agency-wide spend.','Urgent — part of three-way outreach.'),
  s('STAT-062','Sydney Marsh','Capitol Strategies','sydney.marsh@example.com',0,'Public Affairs','T2','A','Hot','Newsletter (client-specific)','Specific client opportunity flagged — opportunity to reapproach after recent industry event.','Email; reference event-based relationship.'),
  s('STAT-063','Parker Lane','Petrol Energy','parker.lane@example.com',0,'Public Affairs','T2','A','Hot','Multi (campaign-anchored)','Multiplatform proposal to amplify national investment campaign. Specific brief, live campaign.','Urgent — email with mirror proposal.'),
  s('STAT-064','Wren Okafor','GreenPath Solutions','wren.okafor@example.com',150000,'Public Affairs','T2','A','Hot','Multi (Climate Week anchored)','Estimated revenue flagged. Climate Week and international summits provide multiple live entry points.','Urgent — email in Q2 for September event window.'),
  s('STAT-065','River Nash','MegaMart','river.nash@example.com',0,'Public Affairs','T2','A','Warm','Multi (tentpole)','Senior exec on corporate affairs side. Portfolio decision. Goes bigger and faster when bought in.','Pair with company outreach.'),
  s('STAT-066','Oakley Shaw','Capitol Strategies','oakley.shaw@example.com',0,'Public Affairs','T2','A','Warm','Multi (agency MSA)','Attended company event (RSVP confirmed). Founding partner and peer of agency leadership on direction decisions.','Email to continue event-based relationship.'),
  s('STAT-067','Lennox Page','TelcoMax','lennox.page@example.com',0,'Public Affairs','T2','B','Warm','Newsletter + Event','Company has multiple contacts in book — recurring spend pattern. SVP PA senior enough to sign off on annual placements.','Email; formal outreach.'),
  s('STAT-068','Charlie Wise','Senior Advocacy Group','charlie.wise@example.com',0,'Public Affairs','T2','B','Warm','Newsletter','Organization has deepest trade-association presence in book. Chief Policy Officer owns policy-comms budget.','Email; coordinate with existing contacts.'),
  s('STAT-069','Jesse Franco','Grand Hotels International','jesse.franco@example.com',0,'Public Affairs','T2','B','Warm','Event + Newsletter','Company has multiple contacts — active relationship. Global Head of Marketing owns premium-publisher budget.','Email; propose event partnership.'),
  s('STAT-070','Nadia Pham','AutoMotion','nadia.pham@example.com',0,'Public Affairs','T2','B','Warm','Newsletter','Company has multiple contacts — active book. Industry narrative gives budget rationale.','Email; offer themed content tie-in.'),
  // T2 / Media
  s('STAT-071','Kai Lindgren','Storybook Entertainment','kai.lindgren@example.com',0,'Media','T2','B','Warm','Newsletter + Event','Only company contact in the book. Any relationship is strategic. LinkedIn-verify title first.','LinkedIn-verify title; then discovery email.'),
  s('STAT-072','TBD — Head of Awards Marketing','Horizon Media Group','',0,'Media','T2','A','Cold','Multi (awards season + tentpoles)','Prestige content is strong audience match. Post-restructuring narrative keeps company in coverage.','LinkedIn to awards marketing leadership.'),
  s('STAT-073','TBD — Head of Corporate Comms','Legacy Entertainment','',0,'Media','T2','A','Cold','Multi','Ongoing corporate narrative dominating industry coverage. Company needs to reach that exact audience.','Cold outreach; high news-cycle relevance.'),
  s('STAT-074','TBD — VP Marketing/Head of Comms','Orchard Streaming','',0,'Media','T2','A','Cold','Multi (awards + launch)','Awards push underfinanced in premium insider media vs competitors. Underserved category.','LinkedIn; company is notoriously closed — expect long cycle.'),
  s('STAT-075','TBD — President, Brand Consulting','Premier Talent Agency','',0,'Media','T2','A','Cold','Partnership (agency side)','Brand consulting arm places dollars into culturally relevant media. Exact placement brief match.','Warm intro via any entertainment contact; do not cold-email.'),
  s('STAT-076','TBD — Head of Partnerships','Digital Media Inc','',0,'Media','T2','B','Cold','Cross-promo + ad sales','Company owns adjacent media title. Partnership and possible cross-publication opportunity.','LinkedIn; parallel to other media outreach.'),
  s('STAT-077','TBD — Head of Podcast Ad Sales','AudioMax Networks','',0,'Media','T2','B','Cold','Podcast (Power Lines)','Largest podcast ad sales network. Distribution-plus-ads model. Competitor to streaming outreach.','Parallel to streaming outreach; same framing.'),
  s('STAT-078','TBD — Publicity Director, Nonfiction','Prestige Publishing House','',0,'Media','T2','B','Cold','Newsletter (launch-tied)','Major media-industry book launches go through this nonfiction desk. Strong launch audience alignment.','Email via publicist network; rep-per-rep.'),
  s('STAT-079','TBD — Head of Communications','Elite Talent Group','',0,'Media','T2','B','Cold','Partnership (agency side)','Corporate side and talent reps represent two different buyers. Start with corporate comms.','Warm intro preferred; soft outreach.'),
  s('STAT-080','TBD — Head of Corporate Partnerships','Luxe Publishing','',0,'Media','T2','B','Cold','Cross-promo','Company referenced in sales deck — a warm surface. Multiple titles overlap with audience.','LinkedIn; reference prior coverage.'),
];

for (const client of clients) {
  await db.query(
    `INSERT INTO status_clients (id, data) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [client.id, JSON.stringify(client)]
  );
}
await db.end();
console.log(`✓ Seeded ${clients.length} clients into status_clients.`);
