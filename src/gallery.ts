/**
 * The Gallery (ADR-0004): pattern name → payload (the part of a pattern link after `#p=`), newest first.
 * Add a pattern by putting it at the top; replace its payload when sending a corrected version.
 * The name shown in the Gallery is the key here; size and preview are decoded from the payload.
 * Keep names non-numeric: JavaScript puts number-like keys (e.g. "2024") before all others.
 */
export const galleryPatterns: Record<string, string> = {
  truskawka_6:
    'AWNgY4hl_vPjPwNbUmbi0abKBWziDHzJmam5efnJValF5fl5lUb-Rgy8EKGqzNSc_LxKBu6SotLi7MTy7MR4MwYoaBBjjBAFMUJUHaYwMTBwMCaINgYwMDCwOoVwOijQRQEQAAA',
  jamnik:
    'AZWOMQqCUABAn2WWDhGfthYHly7QFOGYlwhUJMz8ggjynSJoD7cO0R0ibOsSbS3eobZo9G1veTwsloPr840VPI7NJYkLqTZzk3EYR6nMgrw5VVmpZqsac5v70i-yUrXti2GSR2lWqunIwggrP5cKY-enMk7ohAaYgAPcQaz1nmcLz0FzQD-DcKGG_h5MGxa3jurxl_qpLlyEB-jfjwNMOlx_AA',
  payday_20:
    'AY1QPU_bUBQ9DobGQ6T4NUNQFjDPUSplqFBkqZtBRvghkJBgKCyNBUikjRMUhshMj6oDH4vz-BAsCKGQP4DkiYVWHQxTlY38AJYWiX8ANh0qdckZ7tXRvfecey8ymBoEgKGVLadR8_78fsCbL401t970zk6PMLi55TS84MM0kq5TrdTqTe_p9hGpz85mrd74cfXzut70oGw43qrjfRp_j38h8zjtTx2kAeilpXETIEuFYcqh6mRb2DwpwvVs24daDG5mgxMp063m79a4OmfcFDsfpcyvdXK7ioR--HW2Y0JesLSwDEil5eJ5JM04-oCwo6jqTDEBhSyKSQ5tt8CoD8kSXLB0ss10hbZwUCEzTNtRjBa9fKFvNwQnLA26ZyvUB1LaN2HzWGrUBEAF68c_hpRtv4t-wvZkBiT0LLcEQEJ_bJRCrR5_p2Iena6rMR3ENe4tYUv5rnsR0b_VfAi5RZFgh_EsxERiJlKmrwf2h5KINkevokWzboBIyuiVZVZALqamFORcwigGykZIhQkDVfmVvjRzDPXKYCNAKoDlA8hVyPx_Ns8',
  halloween:
    'AU2QQUrEQBREX8e0zKzsQHoruYa7HjXgsge6DjBIRCFMYBgIcemV3LqTOYKn8BLSmQjz4UPVpwoen4qHq_FuYv3yNvTdcRin6qbi-vl9d9hPvz-3rE5f35-nj-PE-nXX98PYdXsuprmUDrCASYsgALMJYO-XQ1wSEeYKJQ3lfzcnFMAnVlYBozgbrMDoCXwEmzBtxEoYo2iCFLRVdE4qrRQ2UvTaJnxMmJRANfgWbAxYOaxKrB4b04Yzl5tRMmQAV2egjFhTYDJZNn5ZU5xRc2JGDlAsj_gD',
};
