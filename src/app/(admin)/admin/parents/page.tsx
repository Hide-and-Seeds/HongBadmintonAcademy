import { PeopleList } from "../_people/people-list";
import { deletePerson, deletePeople } from "../_people/actions";

export const dynamic = "force-dynamic";

export default function ParentsPage() {
  return (
    <PeopleList
      role="parent"
      deleteAction={deletePerson.bind(null, "parent")}
      deleteManyAction={deletePeople.bind(null, "parent")}
    />
  );
}
