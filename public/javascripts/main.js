// This is a script from w3cschools, modified by me
// https://www.w3schools.com/howto/howto_js_collapsible.asp

let coll = document.getElementsByClassName("polaroid-member");
let i;

for (i = 0; i < coll.length; i++) {
    coll[i].children[0].addEventListener("click", function() {
        this.classList.toggle("active");
        let content = this.nextElementSibling;
        console.log(content.classList.toString())
        if (content.style.maxHeight){
            content.style.maxHeight = null;
            content.style.padding = "0"
        } else {
            content.style.maxHeight = content.scrollHeight + "px";
            content.style.padding = "1em 0"
        }
    });
}