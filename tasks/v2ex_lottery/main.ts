import type { Context } from "@oomol/types/oocana";
import pLimit from "p-limit";

const API = "https://www.v2ex.com/api/v2/topics";

//#region generated meta
type Inputs = {
  topicID: number;
  excludes: string[] | null;
  count: number;
  token: string;
};
type Outputs = {
  output: string[];
};
//#endregion

export default async function(
  params: Inputs,
  context: Context<Inputs, Outputs>
): Promise<Outputs> {
  let set = await findReplies(params.topicID, params.token, context);

  params.excludes?.forEach(name => {
    set.delete(name)
  });

  context.reportProgress(99);

  const names = Array.from(set);
  for (let i = 0; i < 10; i++) {
    shuffle(names);
  }

  const output = names.slice(0, params.count);

  context.preview({
    type: "text",
    data: output.join("\n"),
  })

  context.reportProgress(100);

  return {
    output,
  };
};

async function findReplies(id: number, token: string, context: Context<Inputs, Outputs>) {
  const replieCount: number = await request(`${API}/${id}`, token).then((res) => res.replies);

  const limit = pLimit(10);
  const ps: Promise<void>[] = [];

  let finishCount = 0;

  const reportProgress = () => {
    const progress = finishCount / replieCount * 100 - 2;
    context.reportProgress(Math.max(progress, 1));
  }

  const result = new Set<string>();

  for(let i = 1; i <= replieCount; i++) {
    const fn = () => request(`${API}/${id}/replies?p=${i}`, token)
      .then(replies => {
        replies.forEach(({ member }) => {
          result.add(member.username);
        });
        finishCount++;
        reportProgress();
      });

    ps.push(limit(fn))
  }

  await Promise.all(ps);

  return result;
}

async function request(url: string, token: string) {
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`
    },
    method: "GET",
  });

  if (!res.ok) {
    throw new Error(`Fetch error: ${res.statusText}`);
  }

  const result = await res.json();
  return result.result;
}

// ref: https://stackoverflow.com/a/2450976
function shuffle(array: any[]) {
  let currentIndex = array.length;
  while (currentIndex != 0) {
    let randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
}
