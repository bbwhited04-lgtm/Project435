// Replace with HTTP or direct DB bridge to Pluto
import { TokenVault } from "../../pluto/src/vault/TokenVault.js";
import { plutoDb } from "../db/pluto.js";

const vault = new TokenVault(plutoDb);

export const plutoClient = {
  upsertToken: vault.upsertToken.bind(vault),
  getToken: vault.getToken.bind(vault),
  disableToken: vault.disableToken.bind(vault),
};
