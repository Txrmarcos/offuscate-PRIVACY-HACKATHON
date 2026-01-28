/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/offuscate.json`.
 */
export type Offuscate = {
  "address": "5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq",
  "metadata": {
    "name": "offuscate",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "acceptInvite",
      "docs": [
        "Accept an invite and register stealth address",
        "The recipient provides their stealth meta-address"
      ],
      "discriminator": [
        173,
        11,
        225,
        180,
        81,
        89,
        93,
        138
      ],
      "accounts": [
        {
          "name": "recipient",
          "writable": true,
          "signer": true
        },
        {
          "name": "invite",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  118,
                  105,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "invite.invite_code",
                "account": "invite"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "stealthMetaAddress",
          "type": "string"
        }
      ]
    },
    {
      "name": "acceptInviteStreaming",
      "docs": [
        "Accept invite AND automatically add to streaming payroll",
        "",
        "PRIVACY FLOW:",
        "1. Employee generates a stealth keypair LOCALLY (not their main wallet)",
        "2. Passes the stealth PUBLIC KEY as employee_stealth_pubkey",
        "3. Employee account is created with wallet = stealth pubkey",
        "4. Employee keeps stealth PRIVATE KEY locally",
        "5. To claim salary, employee signs with stealth keypair",
        "",
        "Result: On-chain shows \"stealth ABC receives payment\"",
        "No one knows stealth ABC belongs to which real person"
      ],
      "discriminator": [
        186,
        69,
        117,
        202,
        8,
        231,
        192,
        74
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Payer for the transaction (can be main wallet or relayer)"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "employeeStealthPubkey",
          "docs": [
            "The stealth public key that will own the Employee account",
            "This is generated locally by the employee, NOT their main wallet"
          ]
        },
        {
          "name": "invite",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  118,
                  105,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "invite.invite_code",
                "account": "invite"
              }
            ]
          }
        },
        {
          "name": "masterVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  115,
                  116,
                  101,
                  114,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "batch",
          "docs": [
            "The batch this invite belongs to (via invite.batch -> campaign)"
          ],
          "writable": true
        },
        {
          "name": "employee",
          "docs": [
            "The new employee account (created with stealth pubkey)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  109,
                  112,
                  108,
                  111,
                  121,
                  101,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "batch"
              },
              {
                "kind": "account",
                "path": "batch.employee_count",
                "account": "payrollBatch"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "stealthMetaAddress",
          "type": "string"
        }
      ]
    },
    {
      "name": "addEmployee",
      "docs": [
        "Add an employee to a batch with streaming salary"
      ],
      "discriminator": [
        14,
        82,
        239,
        156,
        50,
        90,
        189,
        61
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "masterVault",
          "writable": true
        },
        {
          "name": "batch",
          "writable": true
        },
        {
          "name": "employeeWallet"
        },
        {
          "name": "employee",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  109,
                  112,
                  108,
                  111,
                  121,
                  101,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "batch"
              },
              {
                "kind": "account",
                "path": "batch.employee_count",
                "account": "payrollBatch"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "stealthAddress",
          "type": "string"
        },
        {
          "name": "salaryRate",
          "type": "u64"
        }
      ]
    },
    {
      "name": "batchClaimWithdraw",
      "docs": [
        "BATCH CLAIM WITHDRAWALS",
        "",
        "PRIVACY FEATURE: Processes multiple pending withdrawals in a single transaction.",
        "This breaks the visual pattern of \"1 withdraw = 1 tx\" that analysts use for correlation.",
        "",
        "remaining_accounts: pairs of [recipient_account, pending_withdraw_pda] for each withdrawal",
        "Max 5 withdrawals per batch to stay within compute limits."
      ],
      "discriminator": [
        110,
        48,
        27,
        157,
        224,
        116,
        14,
        152
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  118,
                  97,
                  99,
                  121,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "poolVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "claimSalary",
      "docs": [
        "Employee claims accrued salary (streaming)"
      ],
      "discriminator": [
        253,
        112,
        47,
        40,
        140,
        213,
        22,
        141
      ],
      "accounts": [
        {
          "name": "recipient",
          "writable": true,
          "signer": true
        },
        {
          "name": "masterVault",
          "writable": true
        },
        {
          "name": "batch",
          "writable": true
        },
        {
          "name": "batchVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  99,
                  104,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "batch"
              }
            ]
          }
        },
        {
          "name": "employee",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "claimWithdraw",
      "docs": [
        "Claim a pending withdrawal after the delay has passed",
        "",
        "PRIVACY: The recipient (stealth address) signs to claim.",
        "Observers cannot link this to the original deposit."
      ],
      "discriminator": [
        232,
        89,
        154,
        117,
        16,
        204,
        182,
        224
      ],
      "accounts": [
        {
          "name": "recipient",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  118,
                  97,
                  99,
                  121,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "poolVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "pendingWithdraw",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "recipient"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "claimWithdrawRelayed",
      "docs": [
        "Claim a pending withdrawal via RELAYER (gasless for recipient)",
        "",
        "PRIVACY FEATURE: The recipient does NOT pay gas and does NOT appear as tx signer.",
        "Instead, a relayer submits the transaction and pays fees.",
        "The recipient proves ownership by signing a message off-chain (ed25519).",
        "",
        "Flow:",
        "1. Recipient signs message: \"claim:{pending_pda}\" with stealth keypair",
        "2. Relayer creates ed25519 verify instruction + this instruction",
        "3. Relayer submits tx and pays gas",
        "4. Funds go to stealth address without it being fee payer",
        "",
        "This breaks: stealth_address -> fee payer link"
      ],
      "discriminator": [
        141,
        26,
        13,
        242,
        114,
        55,
        33,
        175
      ],
      "accounts": [
        {
          "name": "relayer",
          "docs": [
            "Relayer pays gas (any wallet can be relayer)"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "recipient",
          "docs": [
            "Ownership is proven via ed25519 signature in previous instruction"
          ],
          "writable": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  118,
                  97,
                  99,
                  121,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "poolVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "pendingWithdraw",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "pending_withdraw.recipient",
                "account": "pendingWithdraw"
              }
            ]
          }
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "closeCampaign",
      "docs": [
        "Close a campaign (only owner)"
      ],
      "discriminator": [
        65,
        49,
        110,
        7,
        63,
        238,
        206,
        77
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "campaign"
          ]
        },
        {
          "name": "campaign",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.campaign_id",
                "account": "campaign"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createBatch",
      "docs": [
        "Create a new payroll batch (index-based PDA)"
      ],
      "discriminator": [
        159,
        198,
        248,
        43,
        248,
        31,
        235,
        86
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "masterVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  115,
                  116,
                  101,
                  114,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "batch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "masterVault"
              },
              {
                "kind": "account",
                "path": "master_vault.batch_count",
                "account": "masterVault"
              }
            ]
          }
        },
        {
          "name": "batchVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  99,
                  104,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "batch"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "title",
          "type": "string"
        }
      ]
    },
    {
      "name": "createBatchInvite",
      "docs": [
        "Create an invite for a recipient to join a payroll batch (using PayrollBatch)",
        "Only the batch owner can create invites",
        "salary_rate: lamports per second (0 = no streaming, just invite)"
      ],
      "discriminator": [
        205,
        243,
        110,
        27,
        187,
        67,
        179,
        80
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "batch"
          ]
        },
        {
          "name": "batch",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "batch.master_vault",
                "account": "payrollBatch"
              },
              {
                "kind": "account",
                "path": "batch.index",
                "account": "payrollBatch"
              }
            ]
          }
        },
        {
          "name": "invite",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  118,
                  105,
                  116,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "inviteCode"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "inviteCode",
          "type": "string"
        },
        {
          "name": "salaryRate",
          "type": "u64"
        }
      ]
    },
    {
      "name": "createCampaign",
      "docs": [
        "Create a new campaign with a vault PDA",
        "The vault is controlled by the program, not the owner"
      ],
      "discriminator": [
        111,
        131,
        187,
        98,
        160,
        193,
        114,
        244
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "campaign",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "campaignId"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "campaignId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "campaignId",
          "type": "string"
        },
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "goal",
          "type": "u64"
        },
        {
          "name": "deadline",
          "type": "i64"
        }
      ]
    },
    {
      "name": "createInvite",
      "docs": [
        "Create an invite for a recipient to join a payroll batch",
        "Only the batch owner can create invites",
        "salary_rate: lamports per second (0 = no streaming, just invite)"
      ],
      "discriminator": [
        160,
        94,
        130,
        54,
        134,
        245,
        255,
        229
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "campaign"
          ]
        },
        {
          "name": "campaign",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.campaign_id",
                "account": "campaign"
              }
            ]
          }
        },
        {
          "name": "invite",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  118,
                  105,
                  116,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "inviteCode"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "inviteCode",
          "type": "string"
        },
        {
          "name": "salaryRate",
          "type": "u64"
        }
      ]
    },
    {
      "name": "createReceipt",
      "docs": [
        "Create an anonymous receipt when claiming salary",
        "Called after claim_salary to create a verifiable proof of payment"
      ],
      "discriminator": [
        187,
        57,
        104,
        13,
        15,
        1,
        219,
        99
      ],
      "accounts": [
        {
          "name": "employeeSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "employee"
        },
        {
          "name": "batch"
        },
        {
          "name": "receipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  99,
                  101,
                  105,
                  112,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "employee.wallet",
                "account": "employee"
              },
              {
                "kind": "account",
                "path": "batch"
              },
              {
                "kind": "account",
                "path": "employee.total_claimed",
                "account": "employee"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "receiptSecret",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "donate",
      "docs": [
        "Donate to a campaign",
        "Funds go to the vault PDA, not the owner",
        "The donor can use a stealth address as the source"
      ],
      "discriminator": [
        121,
        186,
        218,
        211,
        73,
        70,
        196,
        180
      ],
      "accounts": [
        {
          "name": "donor",
          "writable": true,
          "signer": true
        },
        {
          "name": "campaign",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.campaign_id",
                "account": "campaign"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "campaign.campaign_id",
                "account": "campaign"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "fundBatch",
      "docs": [
        "Fund a batch's vault"
      ],
      "discriminator": [
        177,
        109,
        157,
        28,
        93,
        74,
        138,
        48
      ],
      "accounts": [
        {
          "name": "funder",
          "writable": true,
          "signer": true
        },
        {
          "name": "masterVault",
          "writable": true
        },
        {
          "name": "batch",
          "writable": true
        },
        {
          "name": "batchVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  99,
                  104,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "batch"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "getPoolStats",
      "docs": [
        "Get pool stats (view function for frontend)"
      ],
      "discriminator": [
        119,
        221,
        164,
        30,
        10,
        6,
        255,
        128
      ],
      "accounts": [
        {
          "name": "pool",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  118,
                  97,
                  99,
                  121,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "poolVault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "initChurnVault",
      "docs": [
        "Initialize a churn vault (call once per vault: 0, 1, 2)",
        "",
        "PRIVACY FEATURE: Churn vaults enable internal micro-movements that",
        "break graph heuristics used by blockchain analysts."
      ],
      "discriminator": [
        133,
        111,
        217,
        28,
        20,
        159,
        236,
        173
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  118,
                  97,
                  99,
                  121,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "churnState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  117,
                  114,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "vaultIndex"
              }
            ]
          }
        },
        {
          "name": "churnVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  117,
                  114,
                  110,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "vaultIndex"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "vaultIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initMasterVault",
      "docs": [
        "Initialize the global master vault (one-time setup)"
      ],
      "discriminator": [
        30,
        213,
        201,
        63,
        95,
        25,
        93,
        24
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "masterVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  115,
                  116,
                  101,
                  114,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initPrivacyPool",
      "docs": [
        "Initialize the global privacy pool",
        "Called once to create the pool PDA"
      ],
      "discriminator": [
        108,
        181,
        246,
        189,
        130,
        203,
        36,
        209
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  118,
                  97,
                  99,
                  121,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "poolVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "poolChurn",
      "docs": [
        "Pool Churn - Move funds from main pool to churn vault",
        "",
        "PRIVACY: Creates internal transactions that look like real activity.",
        "Breaks the pattern: deposit → (delay) → withdraw",
        "Into: deposit → churn → unchurn → (delay) → withdraw"
      ],
      "discriminator": [
        199,
        230,
        143,
        4,
        207,
        19,
        192,
        249
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  118,
                  97,
                  99,
                  121,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "poolVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "churnState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  117,
                  114,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "churn_state.vault_index",
                "account": "churnVaultState"
              }
            ]
          }
        },
        {
          "name": "churnVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  117,
                  114,
                  110,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "churn_state.vault_index",
                "account": "churnVaultState"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "poolDeposit",
      "docs": [
        "Deposit SOL into the privacy pool",
        "",
        "PRIVACY: This instruction intentionally does NOT track:",
        "- Who deposited (sender)",
        "- Who will receive (receiver)",
        "- Which campaign (if any)",
        "- The individual deposit (only aggregate stats)",
        "",
        "This breaks the link between donor and recipient."
      ],
      "discriminator": [
        26,
        109,
        164,
        79,
        207,
        145,
        204,
        217
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  118,
                  97,
                  99,
                  121,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "poolVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "poolUnchurn",
      "docs": [
        "Pool Unchurn - Return funds from churn vault to main pool",
        "",
        "PRIVACY: Second step of churn - returns funds, adding noise to the graph."
      ],
      "discriminator": [
        41,
        228,
        57,
        124,
        86,
        30,
        192,
        182
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  118,
                  97,
                  99,
                  121,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "poolVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "churnState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  117,
                  114,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "churn_state.vault_index",
                "account": "churnVaultState"
              }
            ]
          }
        },
        {
          "name": "churnVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  117,
                  114,
                  110,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "churn_state.vault_index",
                "account": "churnVaultState"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "privateDeposit",
      "docs": [
        "Private deposit with commitment",
        "",
        "PRIVACY FLOW:",
        "1. User generates: secret (32 bytes random), nullifier_secret (32 bytes random)",
        "2. User computes: commitment = hash(secret_hash || nullifier || amount_bytes)",
        "where secret_hash = hash(secret), nullifier = hash(nullifier_secret)",
        "3. User calls this instruction with commitment hash",
        "4. On-chain: creates CommitmentPDA with commitment hash (not secrets)",
        "",
        "Even an advanced indexer only sees:",
        "- A deposit happened",
        "- The commitment hash",
        "- The amount (one of standardized amounts)",
        "Cannot link to future withdrawal without knowing the secrets"
      ],
      "discriminator": [
        77,
        169,
        194,
        35,
        212,
        3,
        79,
        92
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  118,
                  97,
                  99,
                  121,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "poolVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "commitmentPda",
          "docs": [
            "Commitment PDA - stores the commitment hash",
            "Derived from the commitment bytes so only one deposit per commitment"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  109,
                  109,
                  105,
                  116,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "commitment"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "commitment",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "privateWithdraw",
      "docs": [
        "Private withdraw with nullifier",
        "",
        "PRIVACY FLOW:",
        "1. User provides: nullifier = hash(nullifier_secret)",
        "2. User provides: secret_hash = hash(secret)",
        "3. User provides: recipient address (stealth address)",
        "4. On-chain verifies:",
        "- Commitment PDA exists for hash(secret_hash || nullifier || amount_bytes)",
        "- Nullifier not already used (NullifierPDA doesn't exist)",
        "5. Creates NullifierPDA (marks as used), transfers to recipient",
        "",
        "The nullifier breaks the link:",
        "- Nullifier is derived from nullifier_secret known only to depositor",
        "- Cannot be correlated to the original commitment without the secrets"
      ],
      "discriminator": [
        90,
        238,
        7,
        17,
        97,
        6,
        181,
        221
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Payer for the transaction (can be anyone)"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "recipient",
          "writable": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  118,
                  97,
                  99,
                  121,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "poolVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "commitmentPda",
          "docs": [
            "Commitment PDA - verify it exists and hasn't been spent",
            "The commitment is recomputed from secret_hash || nullifier || amount"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  109,
                  109,
                  105,
                  116,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "commitment_pda.commitment",
                "account": "commitmentPda"
              }
            ]
          }
        },
        {
          "name": "nullifierPda",
          "docs": [
            "Nullifier PDA - created to mark this nullifier as used",
            "If this account already exists, the withdrawal will fail (double-spend prevention)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  117,
                  108,
                  108,
                  105,
                  102,
                  105,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "nullifier"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nullifier",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "secretHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "privateWithdrawRelayed",
      "docs": [
        "Private withdraw via relayer (gasless)",
        "",
        "Same as private_withdraw but with relayer paying gas.",
        "Uses ed25519 signature verification to prove recipient ownership."
      ],
      "discriminator": [
        224,
        44,
        61,
        93,
        227,
        80,
        139,
        178
      ],
      "accounts": [
        {
          "name": "relayer",
          "docs": [
            "Relayer pays gas"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "recipient",
          "writable": true
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  118,
                  97,
                  99,
                  121,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "poolVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "commitmentPda",
          "docs": [
            "Commitment PDA"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  109,
                  109,
                  105,
                  116,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "commitment_pda.commitment",
                "account": "commitmentPda"
              }
            ]
          }
        },
        {
          "name": "nullifierPda",
          "docs": [
            "Nullifier PDA - created to mark this nullifier as used"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  117,
                  108,
                  108,
                  105,
                  102,
                  105,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "nullifier"
              }
            ]
          }
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nullifier",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "secretHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "registerStealthPayment",
      "docs": [
        "Register a stealth payment (metadata only, NO SOL transfer)",
        "This helps the recipient scan for their payments",
        "The actual SOL goes directly to the stealth address via SystemProgram"
      ],
      "discriminator": [
        111,
        87,
        72,
        226,
        219,
        65,
        222,
        131
      ],
      "accounts": [
        {
          "name": "donor",
          "writable": true,
          "signer": true
        },
        {
          "name": "campaign",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.campaign_id",
                "account": "campaign"
              }
            ]
          }
        },
        {
          "name": "registry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  101,
                  97,
                  108,
                  116,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "campaign"
              },
              {
                "kind": "arg",
                "path": "stealthAddress"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "stealthAddress",
          "type": "pubkey"
        },
        {
          "name": "ephemeralPubKey",
          "type": "string"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "requestWithdraw",
      "docs": [
        "Request a withdrawal from the privacy pool",
        "",
        "Creates a pending withdrawal with a VARIABLE time delay (30s - 5min).",
        "The amount must be one of the standardized amounts.",
        "",
        "PRIVACY: Only the stealth_address is recorded (not who requested).",
        "The variable delay prevents timing correlation attacks."
      ],
      "discriminator": [
        137,
        95,
        187,
        96,
        250,
        138,
        31,
        182
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Payer for account rent (the connected wallet)"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "recipient",
          "docs": [
            "The recipient (stealth address keypair - signs to prove ownership)"
          ],
          "signer": true
        },
        {
          "name": "pool",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  118,
                  97,
                  99,
                  121,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "poolVault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "pendingWithdraw",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "recipient"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "revokeInvite",
      "docs": [
        "Revoke an invite (only creator can revoke pending invites)"
      ],
      "discriminator": [
        242,
        199,
        119,
        60,
        153,
        131,
        86,
        153
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "invite",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  118,
                  105,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "invite.invite_code",
                "account": "invite"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "setEmployeeStatus",
      "docs": [
        "Pause/Resume employee streaming"
      ],
      "discriminator": [
        57,
        44,
        4,
        73,
        30,
        22,
        51,
        66
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "batch"
        },
        {
          "name": "employee",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "newStatus",
          "type": {
            "defined": {
              "name": "employeeStatus"
            }
          }
        }
      ]
    },
    {
      "name": "setStealthMetaAddress",
      "docs": [
        "Set stealth meta-address for a campaign",
        "This allows donors to generate stealth addresses for private donations"
      ],
      "discriminator": [
        181,
        193,
        83,
        145,
        180,
        176,
        248,
        39
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "campaign"
          ]
        },
        {
          "name": "campaign",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.campaign_id",
                "account": "campaign"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "stealthMetaAddress",
          "type": "string"
        }
      ]
    },
    {
      "name": "updateSalaryRate",
      "docs": [
        "Update employee salary rate"
      ],
      "discriminator": [
        159,
        147,
        22,
        205,
        193,
        49,
        98,
        88
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "batch"
        },
        {
          "name": "employee",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "newRate",
          "type": "u64"
        }
      ]
    },
    {
      "name": "verifyReceipt",
      "docs": [
        "Verify an anonymous receipt",
        "Anyone can call this to verify that a receipt is valid",
        "The verifier provides all data EXCEPT the amount",
        "If the commitment matches, the receipt is valid"
      ],
      "discriminator": [
        202,
        144,
        21,
        149,
        181,
        189,
        23,
        170
      ],
      "accounts": [
        {
          "name": "verifier",
          "docs": [
            "Anyone can verify a receipt"
          ],
          "signer": true
        },
        {
          "name": "receipt",
          "docs": [
            "The receipt to verify"
          ]
        }
      ],
      "args": [
        {
          "name": "employeeWallet",
          "type": "pubkey"
        },
        {
          "name": "batchKey",
          "type": "pubkey"
        },
        {
          "name": "timestamp",
          "type": "i64"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "secret",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "verifyReceiptBlind",
      "docs": [
        "Generate a blind receipt (for third-party verification without amount)",
        "The employee provides a ZK-like proof without revealing amount"
      ],
      "discriminator": [
        161,
        203,
        21,
        236,
        32,
        44,
        67,
        137
      ],
      "accounts": [
        {
          "name": "verifier",
          "docs": [
            "Anyone can do blind verification"
          ],
          "signer": true
        },
        {
          "name": "receipt",
          "docs": [
            "The receipt to verify (blind)"
          ]
        }
      ],
      "args": [
        {
          "name": "employeeWallet",
          "type": "pubkey"
        },
        {
          "name": "timestampRangeStart",
          "type": "i64"
        },
        {
          "name": "timestampRangeEnd",
          "type": "i64"
        }
      ]
    },
    {
      "name": "withdraw",
      "docs": [
        "Withdraw funds from campaign vault",
        "Only the owner can withdraw"
      ],
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "campaign"
          ]
        },
        {
          "name": "campaign",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.campaign_id",
                "account": "campaign"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "campaign.campaign_id",
                "account": "campaign"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "campaign",
      "discriminator": [
        50,
        40,
        49,
        11,
        157,
        220,
        229,
        192
      ]
    },
    {
      "name": "churnVaultState",
      "discriminator": [
        237,
        225,
        217,
        210,
        118,
        214,
        92,
        218
      ]
    },
    {
      "name": "commitmentPda",
      "discriminator": [
        6,
        85,
        221,
        174,
        38,
        28,
        173,
        164
      ]
    },
    {
      "name": "employee",
      "discriminator": [
        98,
        238,
        61,
        252,
        130,
        77,
        105,
        67
      ]
    },
    {
      "name": "invite",
      "discriminator": [
        230,
        17,
        253,
        74,
        50,
        78,
        85,
        101
      ]
    },
    {
      "name": "masterVault",
      "discriminator": [
        192,
        121,
        86,
        115,
        189,
        157,
        113,
        1
      ]
    },
    {
      "name": "nullifierPda",
      "discriminator": [
        42,
        93,
        11,
        216,
        44,
        39,
        74,
        88
      ]
    },
    {
      "name": "paymentReceipt",
      "discriminator": [
        168,
        198,
        209,
        4,
        60,
        235,
        126,
        109
      ]
    },
    {
      "name": "payrollBatch",
      "discriminator": [
        163,
        228,
        23,
        27,
        184,
        54,
        182,
        104
      ]
    },
    {
      "name": "pendingWithdraw",
      "discriminator": [
        215,
        125,
        62,
        82,
        12,
        143,
        112,
        133
      ]
    },
    {
      "name": "privacyPool",
      "discriminator": [
        133,
        184,
        191,
        79,
        252,
        142,
        190,
        150
      ]
    },
    {
      "name": "stealthRegistry",
      "discriminator": [
        118,
        226,
        153,
        61,
        42,
        197,
        54,
        238
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "campaignIdTooLong",
      "msg": "Campaign ID too long (max 32 chars)"
    },
    {
      "code": 6001,
      "name": "titleTooLong",
      "msg": "Title too long (max 64 chars)"
    },
    {
      "code": 6002,
      "name": "descriptionTooLong",
      "msg": "Description too long (max 256 chars)"
    },
    {
      "code": 6003,
      "name": "invalidGoal",
      "msg": "Invalid goal amount"
    },
    {
      "code": 6004,
      "name": "invalidDeadline",
      "msg": "Invalid deadline"
    },
    {
      "code": 6005,
      "name": "invalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6006,
      "name": "campaignNotActive",
      "msg": "Campaign is not active"
    },
    {
      "code": 6007,
      "name": "campaignEnded",
      "msg": "Campaign has ended"
    },
    {
      "code": 6008,
      "name": "campaignNotEnded",
      "msg": "Campaign has not ended yet"
    },
    {
      "code": 6009,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6010,
      "name": "insufficientFunds",
      "msg": "Insufficient funds in vault"
    },
    {
      "code": 6011,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6012,
      "name": "metaAddressTooLong",
      "msg": "Stealth meta-address too long (max 200 chars)"
    },
    {
      "code": 6013,
      "name": "ephemeralKeyTooLong",
      "msg": "Ephemeral public key too long (max 64 chars)"
    },
    {
      "code": 6014,
      "name": "invalidWithdrawAmount",
      "msg": "Invalid withdrawal amount. Must be 0.1, 0.5, or 1 SOL"
    },
    {
      "code": 6015,
      "name": "insufficientPoolFunds",
      "msg": "Insufficient funds in privacy pool"
    },
    {
      "code": 6016,
      "name": "withdrawNotReady",
      "msg": "Withdrawal not ready yet. Please wait for delay period"
    },
    {
      "code": 6017,
      "name": "alreadyClaimed",
      "msg": "Withdrawal already claimed"
    },
    {
      "code": 6018,
      "name": "batchTooSmall",
      "msg": "Batch too small - need at least 1 withdrawal (2 accounts)"
    },
    {
      "code": 6019,
      "name": "batchInvalidPairs",
      "msg": "Batch accounts must be pairs (recipient + pending)"
    },
    {
      "code": 6020,
      "name": "batchTooLarge",
      "msg": "Batch too large - max 5 withdrawals (10 accounts)"
    },
    {
      "code": 6021,
      "name": "invalidChurnIndex",
      "msg": "Invalid churn vault index (must be 0, 1, or 2)"
    },
    {
      "code": 6022,
      "name": "insufficientChurnFunds",
      "msg": "Insufficient funds in churn vault"
    },
    {
      "code": 6023,
      "name": "invalidSignatureInstruction",
      "msg": "Invalid ed25519 signature instruction"
    },
    {
      "code": 6024,
      "name": "signerMismatch",
      "msg": "Signer does not match pending withdrawal recipient"
    },
    {
      "code": 6025,
      "name": "invalidClaimMessage",
      "msg": "Invalid claim message format (expected 'claim:<pda>')"
    },
    {
      "code": 6026,
      "name": "nullifierAlreadyUsed",
      "msg": "Nullifier has already been used (double-spend attempt)"
    },
    {
      "code": 6027,
      "name": "invalidCommitmentProof",
      "msg": "Invalid commitment proof - preimage does not match stored commitment"
    },
    {
      "code": 6028,
      "name": "commitmentAlreadySpent",
      "msg": "Commitment has already been spent"
    },
    {
      "code": 6029,
      "name": "inviteCodeTooLong",
      "msg": "Invite code too long (max 16 chars)"
    },
    {
      "code": 6030,
      "name": "inviteCodeTooShort",
      "msg": "Invite code too short (min 6 chars)"
    },
    {
      "code": 6031,
      "name": "inviteNotPending",
      "msg": "Invite is not in pending status"
    },
    {
      "code": 6032,
      "name": "stealthAddressRequired",
      "msg": "Stealth address is required"
    },
    {
      "code": 6033,
      "name": "inviteNotFound",
      "msg": "Invite not found"
    },
    {
      "code": 6034,
      "name": "inviteNoSalaryConfigured",
      "msg": "Invite has no salary configured - use accept_invite instead"
    },
    {
      "code": 6035,
      "name": "employeeNotActive",
      "msg": "Employee not active"
    },
    {
      "code": 6036,
      "name": "noSalaryToClaim",
      "msg": "No salary to claim"
    },
    {
      "code": 6037,
      "name": "invalidSalaryRate",
      "msg": "Invalid salary rate"
    },
    {
      "code": 6038,
      "name": "employeeAlreadyExists",
      "msg": "Employee already exists"
    },
    {
      "code": 6039,
      "name": "invalidReceiptProof",
      "msg": "Invalid receipt proof - commitment does not match"
    },
    {
      "code": 6040,
      "name": "receiptEmployeeMismatch",
      "msg": "Receipt employee does not match provided employee"
    },
    {
      "code": 6041,
      "name": "receiptBatchMismatch",
      "msg": "Receipt batch does not match provided batch"
    },
    {
      "code": 6042,
      "name": "receiptTimestampMismatch",
      "msg": "Receipt timestamp does not match provided timestamp"
    },
    {
      "code": 6043,
      "name": "receiptNotFound",
      "msg": "Receipt not found"
    }
  ],
  "types": [
    {
      "name": "batchStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "paused"
          },
          {
            "name": "closed"
          }
        ]
      }
    },
    {
      "name": "campaign",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "campaignId",
            "type": "string"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "goal",
            "type": "u64"
          },
          {
            "name": "totalRaised",
            "type": "u64"
          },
          {
            "name": "donorCount",
            "type": "u64"
          },
          {
            "name": "deadline",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "campaignStatus"
              }
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          },
          {
            "name": "campaignBump",
            "type": "u8"
          },
          {
            "name": "stealthMetaAddress",
            "type": "string"
          },
          {
            "name": "stealthDonations",
            "type": "u64"
          },
          {
            "name": "stealthTotal",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "campaignStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "closed"
          },
          {
            "name": "completed"
          }
        ]
      }
    },
    {
      "name": "churnVaultState",
      "docs": [
        "State for a churn vault (internal mixing vault)",
        "PRIVACY: Enables micro-movements that break graph heuristics"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vaultIndex",
            "type": "u8"
          },
          {
            "name": "totalChurned",
            "type": "u64"
          },
          {
            "name": "churnCount",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "commitmentPda",
      "docs": [
        "Individual PDA for each commitment",
        "Created when a private deposit is made",
        "Stores: commitment hash, amount, timestamp, spent status"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "commitment",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "spent",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "employee",
      "docs": [
        "Employee - Index-based PDA with streaming salary",
        "Seeds: [\"employee\", batch, index]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "batch",
            "type": "pubkey"
          },
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u32"
          },
          {
            "name": "stealthAddress",
            "type": "string"
          },
          {
            "name": "salaryRate",
            "type": "u64"
          },
          {
            "name": "startTime",
            "type": "i64"
          },
          {
            "name": "lastClaimedAt",
            "type": "i64"
          },
          {
            "name": "totalClaimed",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "employeeStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "employeeStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "paused"
          },
          {
            "name": "terminated"
          }
        ]
      }
    },
    {
      "name": "invite",
      "docs": [
        "Invite account - stores invitation for a recipient to join a payroll batch"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "batch",
            "type": "pubkey"
          },
          {
            "name": "inviteCode",
            "type": "string"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "recipientStealthAddress",
            "type": "string"
          },
          {
            "name": "salaryRate",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "inviteStatus"
              }
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "acceptedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "inviteStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "accepted"
          },
          {
            "name": "revoked"
          }
        ]
      }
    },
    {
      "name": "masterVault",
      "docs": [
        "Master Vault - Global singleton that tracks all indices",
        "This hides organizational relationships by using sequential indices"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "batchCount",
            "type": "u32"
          },
          {
            "name": "totalEmployees",
            "type": "u32"
          },
          {
            "name": "totalDeposited",
            "type": "u64"
          },
          {
            "name": "totalPaid",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "nullifierPda",
      "docs": [
        "Individual PDA for each used nullifier",
        "Created when a private withdrawal is made",
        "Existence of this PDA proves the nullifier has been used"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nullifier",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "usedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "paymentReceipt",
      "docs": [
        "Anonymous Payment Receipt",
        "Proves payment was received without revealing the amount",
        "",
        "Privacy Model:",
        "- commitment = hash(employee || batch || timestamp || amount || secret)",
        "- The employee keeps the secret",
        "- To prove payment: reveal (employee, batch, timestamp) + show receipt exists",
        "- To prove specific amount: reveal secret (optional, for full audits)",
        "",
        "Use cases:",
        "- Bank: \"Prove you have income\" → Show receipt, proves employment",
        "- Visa: \"Prove you're employed\" → Show receipt from recent date",
        "- Audit: \"Prove specific amount\" → Reveal secret for full verification"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "employee",
            "type": "pubkey"
          },
          {
            "name": "batch",
            "type": "pubkey"
          },
          {
            "name": "employer",
            "type": "pubkey"
          },
          {
            "name": "commitment",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "receiptIndex",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "payrollBatch",
      "docs": [
        "PayrollBatch - Index-based PDA (no pubkey or name in seeds)",
        "Seeds: [\"batch\", master_vault, index]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "masterVault",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u32"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "employeeCount",
            "type": "u32"
          },
          {
            "name": "totalBudget",
            "type": "u64"
          },
          {
            "name": "totalPaid",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "batchStatus"
              }
            }
          },
          {
            "name": "vaultBump",
            "type": "u8"
          },
          {
            "name": "batchBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "pendingWithdraw",
      "docs": [
        "A pending withdrawal request with time delay",
        "PRIVACY: Only stores recipient (stealth address), not sender"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "requestedAt",
            "type": "i64"
          },
          {
            "name": "availableAt",
            "type": "i64"
          },
          {
            "name": "claimed",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "privacyPool",
      "docs": [
        "The global privacy pool that holds aggregated funds",
        "PRIVACY: Only stores aggregate stats, no individual deposit tracking"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "totalDeposited",
            "type": "u64"
          },
          {
            "name": "totalWithdrawn",
            "type": "u64"
          },
          {
            "name": "depositCount",
            "type": "u64"
          },
          {
            "name": "withdrawCount",
            "type": "u64"
          },
          {
            "name": "churnCount",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "stealthRegistry",
      "docs": [
        "Registry entry for a stealth payment",
        "Stores metadata so recipient can scan and identify their payments"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "campaign",
            "type": "pubkey"
          },
          {
            "name": "stealthAddress",
            "type": "pubkey"
          },
          {
            "name": "ephemeralPubKey",
            "type": "string"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
