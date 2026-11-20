---
id: "us-advanced-chip-export-licensing"
title: "US licence rule on advanced chips for Chinese customers"
shortLabel: "AIC"
status: "active"
category: "policy"
startedAt: "2026-11-19"
updatedAt: "2026-11-20"
summary: "A Bureau of Industry and Security regulation that took effect on 19 November 2026 requires a US licence for advanced chip shipments to Chinese customers made on processes of 16 nanometres or smaller, removing the verification route that had let foundries ship without direct government approval. TSMC and Samsung Electronics told Chinese customers they were suspending some shipments while they apply for licences. Reuters reports no mainland Chinese company is on the US list of approved chip designers, which includes Nvidia, AMD, Apple, MediaTek and Realtek."
author: "editor"
places: []
sources:
  - title: "TSMC tightens China AI chip curbs as new US rules close manufacturing loophole, sources say"
    url: "https://taipeitimes.com/News/biz/archives/2026/11/20/2003868041"
    publisher: "Reuters, via Taipei Times"
    retrievedAt: "2026-11-20"
  - title: "TSMC, Samsung halt some chip shipments to China as US rules take effect"
    url: "https://en.sedaily.com/world/2026/11/20/tsmc-samsung-halt-some-chip-shipments-to-china-as-us-rules"
    publisher: "Seoul Economic Daily"
    retrievedAt: "2026-11-20"
  - title: "TSMC and Samsung suspend certain chip deliveries to Chinese customers under new US export rules"
    url: "https://www.dimsumdaily.hk/tsmc-and-samsung-suspend-certain-chip-deliveries-to-chinese-customers-under-new-us-export-rules%EF%BF%BC/"
    publisher: "Dimsum Daily"
    retrievedAt: "2026-11-20"
  - title: "TSMC and Samsung suspend some chip shipments to China after US export curbs"
    url: "https://tradersunion.com/news/companies/show/4317293-tsmc-samsung-chip-shipments-china-curbs/"
    publisher: "Traders Union"
    retrievedAt: "2026-11-20"
exposures:
  - entity:
      id: "chinese-ai-chip-designers"
      name: "Chinese AI chip designers"
      kind: "sector"
      ticker: null
      sector: "Semiconductors"
    severity: "high"
    confidence: "reported"
    mechanism: "Advanced chips for listed Chinese customers are now presumed controlled, so orders at 16 nanometres and below are stopped unless the customer secures a US licence, and affected customers are generally limited to older process technology."
    asOf: "2026-11-20"
    sources:
      - title: "TSMC tightens China AI chip curbs as new US rules close manufacturing loophole, sources say"
        url: "https://taipeitimes.com/News/biz/archives/2026/11/20/2003868041"
        publisher: "Reuters, via Taipei Times"
        retrievedAt: "2026-11-20"
  - entity:
      id: "tsmc"
      name: "Taiwan Semiconductor Manufacturing Company"
      kind: "company"
      ticker: null
      sector: "Semiconductors"
    severity: "moderate"
    confidence: "reported"
    mechanism: "It can no longer use its own verification of a Chinese design's computing power to establish that the part falls outside US controls, so it has suspended previously permitted advanced manufacturing orders while licences are sought."
    asOf: "2026-11-20"
    sources:
      - title: "TSMC tightens China AI chip curbs as new US rules close manufacturing loophole, sources say"
        url: "https://taipeitimes.com/News/biz/archives/2026/11/20/2003868041"
        publisher: "Reuters, via Taipei Times"
        retrievedAt: "2026-11-20"
  - entity:
      id: "samsung-electronics"
      name: "Samsung Electronics"
      kind: "company"
      ticker: null
      sector: "Semiconductors"
    severity: "moderate"
    confidence: "reported"
    mechanism: "It uses US-origin chipmaking equipment and so must apply for licences for affected shipments; it notified Chinese customers of a pause, with Baidu's Kunlun AI data-centre unit and ByteDance named among them."
    asOf: "2026-11-20"
    sources:
      - title: "TSMC, Samsung halt some chip shipments to China as US rules take effect"
        url: "https://en.sedaily.com/world/2026/11/20/tsmc-samsung-halt-some-chip-shipments-to-china-as-us-rules"
        publisher: "Seoul Economic Daily"
        retrievedAt: "2026-11-20"
  - entity:
      id: "chinese-smartphone-makers"
      name: "Chinese smartphone makers"
      kind: "sector"
      ticker: null
      sector: "Consumer electronics"
    severity: "moderate"
    confidence: "reported"
    mechanism: "The suspension reaches consumer electronics chips as well as AI parts, with Xiaomi, Oppo and Vivo named as affected and manufacturing delays expected while licensing is worked through."
    asOf: "2026-11-19"
    sources:
      - title: "TSMC and Samsung suspend some chip shipments to China after US export curbs"
        url: "https://tradersunion.com/news/companies/show/4317293-tsmc-samsung-chip-shipments-china-curbs/"
        publisher: "Traders Union"
        retrievedAt: "2026-11-20"
---
<p>This entry is a day old and the licensing outcomes are unknown, which is the honest state of it. What has changed structurally is the removal of the self-verification route: the foundry used to be able to establish compliance itself, and now a government decision sits in the middle of each shipment.</p>
