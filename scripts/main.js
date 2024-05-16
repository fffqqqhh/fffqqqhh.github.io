// let myHeading = document.querySelector("h1");
// myHeading.textContent = "Hello Lanhe";
// // alert("fffqqqh");

// document.querySelector("html").addEventListener("click",function(){
// 	alert("Test click event");
// })

let myImage = document.querySelector("img");
myImage.onclick = ()=>{
	let mySrc = myImage.getAttribute("src");
	if(mySrc === "images/code.png")
	{
		myImage.setAttribute("src","images/lanhe-logo.ico");
	}
	else
	{
		myImage.setAttribute("src","images/code.png");
	}
};

let myButton = document.querySelector("button");
let myHeading = document.querySelector("h1");

function setUserName(){
	//该函数首先调用了 prompt() 函数，与 alert() 类似会弹出一个对话框。
	//但是这里需要用户输入数据，并在确定后将数据存储在 myName 变量里。
	let myName = prompt("请输入你的名字");
	if(!myName)
	{
		// setUserName();
		localStorage.setItem("name",fffqqqh);
		myHeading.textContent = "Hello " + myName;
	}
	else
	{
		//接下来将调用 localStorage API，它可以将数据存储在浏览器中供后续获取。
		//这里用 localStorage 的 setItem() 函数来创建一个'name' 数据项，并把 myName 变量复制给它
		localStorage.setItem("name",myName);
		myHeading.textContent = "Hello " + myName;
	}
}

if(! localStorage.getItem("name"))
{
	setUserName();
}
else
{
	let storedName = localStorage.getItem("name");
	myHeading.textContent = "hello "+storedName;
}

myButton.onclick = ()=>{
	setUserName()
};