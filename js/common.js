;(function () {
	if(!('serial' in navigator))
	{
		alert("当前浏览器不支持串口操作");
	}

	let serialPort = null;

	let isReadHex = false;
	let isSendHex = false;
	let isAddCtlf = false;
	let isLoopSend = false;
	let isSendDisplay = false;
	let isNeedScroll = true;

	// navigator.serial.getPorts().then((ports) => {
	// 	if(ports.length > 0)
	// 	{
	// 		console.log("Get the ports length is %d.\n",ports.length);
	// 		serialPort = ports[0];
	// 		console.log("Get the ports is "+serialPort.getInfo().usbVendorId, + serialPort.getInfo().usbProductId);
	// 	}
	// 	else
	// 	{
	// 		console.log("Not get the port");
	// 	}
	// })

	let readflag = false;
	let reader;
	let readableStreamClosed;
	let writeflag = false;
	let writer;
	let writableStreamClosed;
	let textEncoder;
	let serialOpen = false;
	let serialClose = true;
	let serialTimer = null; //串口分包合并时钟

	let loopSendTime = 1000;
	let serialLoopSendTimer = null; //串口循环发送时钟

	let logdate;
	let newmsg;

	let serialData = []; //串口缓存
	let asciidecoder = new TextDecoder();

	const serialToggle = document.getElementById('serial-open-or-close');
	const serialLogs = document.getElementById('serial-logs');

	window.onload = disableSendBtn;

	//时间戳
	function formatDate(now)
	{
		const hour = now.getHours()<10 ? '0'+now.getHours() : now.getHours();
		// console.log("hour is "+hour);
		const min = now.getMinutes()<10 ? '0'+now.getMinutes() : now.getMinutes();
		// console.log("min is "+min);
		const second = now.getSeconds()<10 ? '0'+now.getSeconds() : now.getSeconds();
		// console.log("sec is "+second);
		const millisecond = ('00'+now.getMilliseconds()).slice(-3);

		return `${hour}:${min}:${second}.${millisecond} :`;
	}

	//选择串口
	document.getElementById('serial-select-port').addEventListener('click',async()=>{
		//客户端授权
		try
		{
			await navigator.serial.requestPort().then(async (port)=>{
				if(serialOpen)
				{
					closeSerial();
					serialClose = true;
					await serialPort?.forget();
				}
				
				serialPort = port;
				console.log("Get the port is " + serialPort.getInfo().usbVendorId, + serialPort.getInfo().usbProductId);
				// serialStatusChange(true);
			})
		}
		catch(e)
		{
			showMsg("请先选择串口");
			console.error('获取串口权限出错'+e.toString());
		}
	})

	//打开串口
	async function openSerial(){
		let SerialOptions = {
			baudRate:document.querySelector('#serial-baud').value,
			dataBits:document.querySelector('#serial-data-bits').value,
			stopBits:document.querySelector('#serial-stop-bits').value,
			parity:document.querySelector('#serial-parity').value,
			bufferSize:document.querySelector('#serial-buff-size').value,
			flowControl:document.querySelector('#serial-flow-control').value,
		}

		serialPort.open(SerialOptions).then(()=>{
			console.log("open suc");
			serialToggle.innerHTML = '关闭串口';
			serialOpen = true;
			serialClose = false;
			disableOptions(true);
			// serialLogs.innerHTML = '';
			//使能发送按键
			document.getElementById('serial-send').disabled = false;

			/*
			//创建read数据流
			let textDecoder = new TextDecoderStream();
			readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
			reader = textDecoder.readable.getReader();
			readflag = true;
			*/

			// textEncoder = new TextEncoderStream();
			// writableStreamClosed = textEncoder.readable.pipeTo(serialPort.writable);
			// writer = textEncoder.writable.getWriter();
			// writeflag = true;

			//创建read数据流
			reader = serialPort.readable.getReader();
			readflag = true;
			readData();
		})
		.catch((e)=>{
			showMsg("串口异常,打开失败");
			console.error('打开串口失败'+e.toString());
		})
	}

	//关闭串口
	async function closeSerial() {
		if(serialOpen)
		{
			serialOpen = false;
			serialClose = true;
			
			serialToggle.innerHTML = "打开串口";
			disableOptions(false);
			//失效发送按键
			document.getElementById('serial-send').disabled = true;

			if(readflag)
			{
				reader?.cancel();
				reader.releaseLock();
				// await readableStreamClosed.catch(()=>{});
				readflag = false;
			}
			//这段可以不需要
			if(writeflag)
			{
				// writer.close();
				await writableStreamClosed;
				writeflag = false;
			}

			await serialPort.close();
		}
	}

	//恢复或禁用串口options选项
	function disableOptions(disable)
	{
		document.querySelectorAll('#serial-options .input-group input,#serial-options .input-group select,#serial-select-port').forEach((item)=>{
			item.disabled = disable;
		})
	}

	function HTMLEncode(text)
	{
		let temp = document.createElement('div');
		temp.textContent != null ? (temp.textContent = text) : (temp.innerText = html);
		let out = temp.innerHTML;
		temp = null;
		return out;
	}

	//监听串口开关按键
	serialToggle.addEventListener('click',async()=>{
		if(!serialPort){
			// console.log("请先选择串口");
			showMsg("请选择一个串口")
			return ;
		}

		if(serialPort.writable && serialPort.readable){
			console.log("need close serial");
			closeSerial();
			serialClose = true;
			return ;
		}
		openSerial();
	})

	//串口数据处理
	function dataReceived(data)
	{
		let classname = "text-success";
		let form = '<-';
		newmsg = "";
		// serialData.push(...data);
		//hex
		if(isReadHex)
		{
			let dataHex = [];
			for(const d of data)
			{
				dataHex.push(('0'+d.toString(16).toLocaleUpperCase()).slice(-2))
			}
			newmsg += dataHex.join(' ');
		}
		//text
		else
		{
			let dataAscii = asciidecoder.decode(Uint8Array.from(data));
			//HTMLEncode:将字符串中的特殊字符转换为了html实体
			newmsg += HTMLEncode(dataAscii);
		}

		logdate = formatDate(new Date());
		
		const template = '<div><span class="' + classname + '">'+logdate+form + '</span></div>';
		let tempNode = document.createElement('div');
		tempNode.innerHTML = template;

		const datalate = '<div class="' + classname + '">'+newmsg+'</div>';
		let dataNode = document.createElement('div');
		dataNode.innerHTML = datalate;
		serialLogs.append(tempNode);
		serialLogs.append(dataNode);
		// serialLogs.append("\r\n");

		if(isNeedScroll)
		{
			serialLogs.scrollTop = serialLogs.scrollHeight - serialLogs.clientHeight;
		}
	}

	serialLogs.addEventListener('scroll',function(e){
		let scrolldat;
		scrolldat = serialLogs.scrollHeight - serialLogs.clientHeight;

		if(scrolldat > (serialLogs.scrollTop+5))
		{
			if(isNeedScroll)
			{
				isNeedScroll = false;
			}
		}
		else
		{
			if(!isNeedScroll)
			{
				isNeedScroll = true;
			}
		}
	})

	//读取串口数据
	async function readData()
	{
		while(true)
		{
			const {value,done} = await reader.read();
			// if(value)
			// {
			// 	serialLogs.append(value);
			// 	serialLogs.append("\r\n")
			// 	console.log("read the data is " + value);
			// }
			if(done)
			{
				reader.releaseLock();
				break;
			}
			serialData.push(...value);

			clearTimeout(serialTimer);
			serialTimer = setTimeout(()=>{
				dataReceived(serialData);
				serialData = [];
				},10);
		}
	}

	async function writeData(data)
	{
		/*
		if(!serialPort.writable)
		{
			console.log("serial port is not write func");
			return ;
		}
		textEncoder = new TextEncoderStream();
		writableStreamClosed = textEncoder.readable.pipeTo(serialPort.writable);
		writer = textEncoder.writable.getWriter();
		writeflag = true;
		
		await writer.write(data);
		await writer.close();
		writer.releaseLock();
		console.log("Send Data is "+data);
		*/
		if(!serialPort.writable)
		{
			console.log("串口异常了.\n");
			return ;
		}
		writer = serialPort.writable.getWriter();
		if(isAddCtlf)
		{
			data = new Uint8Array([...data,0x0d,0x0a]);
		}
		await writer.write(data);
		writer.releaseLock();

		if(isSendDisplay)
		{
			//print data
			let classname = "text-primary";
			let form = '->';
			newmsg = "";
			if(isSendHex)
			{
				let sendDataHex = [];
				for (const d of data)
				{
					sendDataHex.push(('0' + d.toString(16).toLocaleUpperCase()).slice(-2));
				}
				newmsg += sendDataHex.join(' ');
			}
			else
			{
				let sendDataAscii = asciidecoder.decode(Uint8Array.from(data));
				newmsg += HTMLEncode(sendDataAscii);
			}

			logdate = formatDate(new Date());

			const template = '<div><span class="' + classname + '">'+logdate+form + '</span></div>';
			let tempNode = document.createElement('div');
			tempNode.innerHTML = template;

			const datalate = '<div class="' + classname + '">'+newmsg+'</div>';
			let dataNode = document.createElement('div');
			dataNode.innerHTML = datalate;

			serialLogs.append(tempNode);
			serialLogs.append(dataNode);
			// serialLogs.append("\r\n");

			if(isNeedScroll)
			{
				serialLogs.scrollTop = serialLogs.scrollHeight - serialLogs.clientHeight;
			}
		}
	}

	async function sendHexData(hex)
	{
		const value = hex.replace(/\s+/g,'');
		if(/^[0-9A-Fa-f]+$/.test(value) && value.length%2===0)
		{
			let data = [];
			for(let i=0;i<value.length;i=i+2)
			{
				data.push(parseInt(value.substring(i,i+2),16));
			}
			await writeData(Uint8Array.from(data));
		}
		else
		{
			console.log("Hex 格式错误.\n");
		}
	}

	async function sendCharData(text)
	{
		const encoder = new TextEncoder();
		writeData(encoder.encode(text));
	}

	async function sendData()
	{
		let content = document.getElementById('serial-send-content').value;
		if(!content)
		{
			console.log("send data is empty.");
		}
		if(isSendHex)
		{
			await sendHexData(content);
		}
		else
		{
			await sendCharData(content);
		}
	}

	//复制文本
	function copyText(text)
	{
		let textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.readOnly = 'readonly';
		textarea.style.position = 'absolute';
		textarea.style.left = '-9999px';

		document.body.appendChild(textarea);

		textarea.select();
		textarea.setSelectionRange(0,textarea.value.length);

		document.execCommand('copy');
		document.body.removeChild(textarea);

		showMsg("已复制");
	}

	//保存文本
	function saveText(text)
	{
		let blob = new Blob([text],{type:'text/plain;charset=utf-8'});
		saveAs(blob,'log.txt');
	}

	function saveAs(blob,filename)
	{
		if(window.navigator.msSaveOrOpenBlob)
		{
			navigator.msSaveBlob(blob,filename);
		}
		else
		{
			let link = document.createElement('a');
			let body = document.querySelector('body');
			link.href = window.URL.createObjectURL(blob);
			link.download = filename;
			link.style.display = 'none';
			body.appendChild(link);
			link.click();
			body.removeChild(link);
			window.URL.revokeObjectURL(link.href);
		}
	}

	//重置循环发送间隔
	function resetLoopSend()
	{
		// clearInterval(serialLoopSendTimer);
		serialLoopSendTimer = setInterval(()=>{
				sendData();
			},loopSendTime);
	}

	//弹窗:使用bootstrap的js模态插件添加对话框
	const modalTip = new bootstrap.Modal("#model-tip");
	function showMsg(msg,title="Web Serial")
	{
		document.getElementById('modal-title').innerHTML = title;
		document.getElementById('modal-message').innerHTML = msg;
		modalTip.show();
	}

	//监听clear按键
	document.getElementById('serial-clear').addEventListener('click',(e)=>{
		serialLogs.innerHTML = '';
	})

	//监听发送按键
	document.getElementById('serial-send').addEventListener('click',(e)=>{
		if(isLoopSend)
		{
			resetLoopSend();
		}
		else
		{
			sendData();
		}
	});

	//串口事件监听
	navigator.serial.addEventListener('connect',(e)=>{
		serialPort = e.target;
		if(!serialClose)
		{
			console.log("==================\n");
		}
	})
	//串口异常断连事件监听
	navigator.serial.addEventListener('disconnect',(e)=>{
		closeSerial();
		// console.log("serial is lost.");
	})

	//页面加载后在串口未打开之前需要先失效发送按键
	function disableSendBtn(){
		document.getElementById('serial-send').setAttribute('disabled',true);
	}

	//监听复制按键
	document.getElementById('serial-copy').addEventListener('click',(e)=>{
		let text = serialLogs.innerText;
		if(text)
		{
			copyText(text);
		}
		else
		{
			showMsg("内容不能为空！");
		}
	})

	//监听保存按键
	document.getElementById('serial-save').addEventListener('click',(e)=>{
		let text = serialLogs.innerText;
		if(text)
		{
			saveText(text);
		}
		else
		{
			showMsg("内容不能为空！");
		}
	})

	document.getElementById('serial-send-display').addEventListener('change',function(e){
		isSendDisplay = !isSendDisplay;
	})

	document.getElementById('serial-hex-read').addEventListener('change',function(e){
		isReadHex = !isReadHex;
	})

	document.getElementById('serial-hex-send').addEventListener('change',function(e){
		isSendHex = !isSendHex;
	})

	document.getElementById('serial-add-crlf').addEventListener('change',function(e){
		isAddCtlf = !isAddCtlf;
	})

	//监听循环发送间隔input
	document.getElementById('serial-loop-send-time').addEventListener('change',function(e) {
		loopSendTime = this.value;
		if(isLoopSend)
		{
			clearInterval(serialLoopSendTimer);
			resetLoopSend();
		}
	})

	//监听循环发送按键
	document.getElementById('serial-loop-send').addEventListener('change',function(e){
		isLoopSend = !isLoopSend;
		if(isLoopSend === true)
		{
			console.log("the loop time is "+loopSendTime);
			// resetLoopSend();
		}
		else
		{
			clearInterval(serialLoopSendTimer);
		}
	})

	document.addEventListener('keydown',function(e){
		if(e.ctrlKey)
		{
			e.preventDefault();
		}
		if(e.keyCode === 123)
		{
			e.preventDefault();
		}
	})

})()