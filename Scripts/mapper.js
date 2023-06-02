import {Tree} from "./d3TreeScript.js";
import data from "../Data/hierarchyData.json" assert {type: "json"};

function mapper() {
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
        fill: "#31A1ED",
        stroke: "#ED7D31"
    })

    return document.body.appendChild(tree);
}

window.mapFunction = mapper()