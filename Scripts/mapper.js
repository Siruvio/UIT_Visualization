import {Tree} from "./d3TreeScript.js";
import data from "../Data/hierarchyData.json" assert {type: "json"};

export function mapFunction() {
    let tree = Tree(data, {
        children: d => d.Children,
        label: d => d.Name,
        title: (d) => {      // hover text
            let synonyms = d.Synonyms
                .map(s => s.charAt(0).toUpperCase() + s.slice(1))
                .map(s => s.replace("_", " "))
                .join(", ");
            if ((synonyms === undefined) || (synonyms === "")) {
                synonyms = "None"
            }

            let verbs = d.Verbs
                .map(s => s.charAt(0).toUpperCase() + s.slice(1))
                .join(", ");
            if ((verbs === undefined) || (verbs === "")) {
                verbs = "None"
            }

            return `Synonyms: ${synonyms}\nAssociated Verbs: ${verbs}`
        },
        link: null,
        width: window.innerWidth,

        r: 4,
        nodeNormClass: "nodeNorm",
        nodeLeafClass: "nodeLeaf",
        stroke: "#999"
    })

    return document.body.appendChild(tree);
}