import { createAdminFixtures } from "../../data/admin/demo";
import { demoCatalogEnabled } from "../data/demo-catalog";

/** Keep local login identities; sample grants belong only to explicit demos. */
export function createLocalAdminState(demo = demoCatalogEnabled()) {
  const state = createAdminFixtures();
  return demo ? state : { ...state, courseAccess: [], courseTeachers: [] };
}
